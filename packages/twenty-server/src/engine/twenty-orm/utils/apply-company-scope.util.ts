import { type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';

import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { type CompanyScope } from 'src/engine/twenty-orm/utils/company-scope.type';

type ScopableQueryBuilder = {
  expressionMap: SelectQueryBuilder<ObjectLiteral>['expressionMap'];
  andWhere: (where: string, parameters?: ObjectLiteral) => unknown;
};

const COMPANY_SCOPE_COLUMN = 'sociedadId';

const ACCESS_OBJECT_NAME = 'accesoSociedad';

// La tabla de empresas guarda DOS cosas distintas: las sociedades del grupo y
// los proveedores y clientes de fuera. Se distinguen por el codigo interno, que
// solo tienen las del grupo.
const COMPANY_OBJECT_NAME = 'company';

// El correo se atribuye por el buzon al que llego, no por un campo propio: lo
// da de alta un flujo externo que no sabe de sociedades, y un campo que ese
// flujo no rellene seria un permiso que no se aplica.
const MAILBOX_OBJECT_NAME = 'correoProcesado';
const MAILBOX_COLUMN = 'buzon';

const resolveScope = (authContext: WorkspaceAuthContext): CompanyScope => {
  if (authContext.type !== 'user') return { kind: 'all' };

  return authContext.companyScope ?? { kind: 'none' };
};

export const applyCompanyScope = ({
  queryBuilder,
  authContext,
  shouldBypassPermissionChecks,
}: {
  queryBuilder: ScopableQueryBuilder;
  authContext: WorkspaceAuthContext;
  shouldBypassPermissionChecks: boolean;
}): void => {
  if (shouldBypassPermissionChecks) return;

  const mainAlias = queryBuilder.expressionMap.mainAlias;

  if (!mainAlias?.name || !mainAlias.hasMetadata) return;

  if (mainAlias.metadata.name === ACCESS_OBJECT_NAME) return;

  const scope = resolveScope(authContext);

  if (scope.kind === 'all') return;

  const alias = mainAlias.name;

  // Sin ninguna sociedad asignada no se ve nada, y eso incluye los objetos con
  // regla propia: se corta antes de mirar de cual se trata.
  if (scope.kind === 'none') {
    queryBuilder.andWhere('1 = 0');

    return;
  }

  if (mainAlias.metadata.name === COMPANY_OBJECT_NAME) {
    // Ocultar tambien los proveedores dejaria las facturas sin nombre de quien
    // las emite —solo el CIF— y vaciaria el panel de proveedores. Lo que se
    // restringe son las sociedades del grupo, que es de lo que hablan los
    // permisos; una empresa de fuera no es de nadie.
    queryBuilder.andWhere(
      `("${alias}"."codigo" IS NULL OR "${alias}"."codigo" = '' ` +
        `OR "${alias}"."id" IN (:...twentyCompanyScopeIds))`,
      { twentyCompanyScopeIds: scope.companyIds },
    );

    return;
  }

  if (mainAlias.metadata.name === MAILBOX_OBJECT_NAME) {
    const esquema = mainAlias.metadata.schema;

    // Un correo cuyo buzon aun no se conoce NO se ve. Falla cerrado a
    // proposito: mientras el flujo no diga a que buzon llego, no hay forma de
    // saber de quien es, y ensenarlo por si acaso seria ensenar el correo de
    // otra sociedad.
    queryBuilder.andWhere(
      `"${alias}"."${MAILBOX_COLUMN}" IN (` +
        `SELECT "empresa"."${MAILBOX_COLUMN}" FROM "${esquema}"."company" "empresa" ` +
        `WHERE "empresa"."id" IN (:...twentyCompanyScopeIds) ` +
        `AND "empresa"."${MAILBOX_COLUMN}" IS NOT NULL ` +
        `AND "empresa"."${MAILBOX_COLUMN}" <> '')`,
      { twentyCompanyScopeIds: scope.companyIds },
    );

    return;
  }

  const isScoped = Boolean(mainAlias.metadata.findColumnWithPropertyPath(COMPANY_SCOPE_COLUMN));

  if (!isScoped) return;

  queryBuilder.andWhere(
    `"${alias}"."${COMPANY_SCOPE_COLUMN}" IN (:...twentyCompanyScopeIds)`,
    { twentyCompanyScopeIds: scope.companyIds },
  );
};
