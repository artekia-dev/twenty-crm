import { applyCompanyScope } from 'src/engine/twenty-orm/utils/apply-company-scope.util';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';

// Un fallo aqui no se ve: la consulta responde, con datos de otra sociedad.
// Nadie lo nota hasta que alguien reconoce una factura que no es suya.

type Llamada = { where: string; params?: Record<string, unknown> };

const construirQueryBuilder = ({
  objeto,
  columnas = [],
  esquema = 'workspace_x',
}: {
  objeto: string;
  columnas?: string[];
  esquema?: string;
}) => {
  const llamadas: Llamada[] = [];

  return {
    llamadas,
    queryBuilder: {
      expressionMap: {
        mainAlias: {
          name: objeto,
          hasMetadata: true,
          metadata: {
            name: objeto,
            schema: esquema,
            findColumnWithPropertyPath: (ruta: string) =>
              columnas.includes(ruta) ? { propertyPath: ruta } : undefined,
          },
        },
      },
      andWhere: (where: string, params?: Record<string, unknown>) => {
        llamadas.push({ where, params });
      },
    } as never,
  };
};

const contexto = (scope: WorkspaceAuthContext['companyScope']): WorkspaceAuthContext =>
  ({ type: 'user', companyScope: scope }) as WorkspaceAuthContext;

const aplicar = (
  objeto: string,
  scope: WorkspaceAuthContext['companyScope'],
  columnas: string[] = [],
) => {
  const { queryBuilder, llamadas } = construirQueryBuilder({ objeto, columnas });

  applyCompanyScope({
    queryBuilder,
    authContext: contexto(scope),
    shouldBypassPermissionChecks: false,
  });

  return llamadas;
};

describe('applyCompanyScope', () => {
  const ALGUNAS = { kind: 'some' as const, companyIds: ['soc-1', 'soc-2'] };

  describe('objetos con sociedad', () => {
    it('filtra la factura por las sociedades asignadas', () => {
      const llamadas = aplicar('factura', ALGUNAS, ['sociedadId']);

      expect(llamadas).toHaveLength(1);
      expect(llamadas[0].where).toContain('"factura"."sociedadId" IN');
      expect(llamadas[0].params?.twentyCompanyScopeIds).toEqual(['soc-1', 'soc-2']);
    });

    it('no toca un objeto que no tiene sociedad', () => {
      expect(aplicar('note', ALGUNAS)).toHaveLength(0);
    });
  });

  describe('sin ninguna sociedad asignada', () => {
    // Falla cerrado: quien no tiene acceso a nada no ve nada, y eso vale
    // tambien para los objetos con regla propia.
    it.each(['factura', 'company', 'correoProcesado'])(
      'no devuelve nada de %s',
      (objeto) => {
        const llamadas = aplicar(objeto, { kind: 'none' }, ['sociedadId']);

        expect(llamadas).toHaveLength(1);
        expect(llamadas[0].where).toBe('1 = 0');
      },
    );
  });

  describe('empresas', () => {
    // La tabla guarda las sociedades del grupo Y los proveedores de fuera.
    // Ocultar los proveedores dejaria las facturas sin nombre de emisor.
    it('deja pasar a los proveedores, que no tienen codigo', () => {
      const llamadas = aplicar('company', ALGUNAS);

      expect(llamadas[0].where).toContain('"company"."codigo" IS NULL');
      expect(llamadas[0].where).toContain(`"company"."codigo" = ''`);
    });

    it('restringe las sociedades del grupo a las asignadas', () => {
      const llamadas = aplicar('company', ALGUNAS);

      expect(llamadas[0].where).toContain('"company"."id" IN (:...twentyCompanyScopeIds)');
      expect(llamadas[0].params?.twentyCompanyScopeIds).toEqual(['soc-1', 'soc-2']);
    });

    // Sin el parentesis, el OR se comeria el resto del WHERE y devolveria
    // TODAS las empresas: el permiso quedaria anulado sin dar ningun error.
    it('agrupa el OR entre parentesis', () => {
      const { where } = aplicar('company', ALGUNAS)[0];

      expect(where.startsWith('(')).toBe(true);
      expect(where.trimEnd().endsWith(')')).toBe(true);
    });
  });

  describe('correos procesados', () => {
    it('se filtran por el buzon de las sociedades asignadas', () => {
      const llamadas = aplicar('correoProcesado', ALGUNAS);

      expect(llamadas[0].where).toContain('"correoProcesado"."buzon" IN');
      expect(llamadas[0].where).toContain('"workspace_x"."company"');
      expect(llamadas[0].params?.twentyCompanyScopeIds).toEqual(['soc-1', 'soc-2']);
    });

    // Un correo cuyo buzon no se conoce no se ve. Mientras el flujo de entrada
    // no diga a que buzon llego, no hay forma de saber de quien es.
    it('descarta los buzones vacios de la comparacion', () => {
      const { where } = aplicar('correoProcesado', ALGUNAS)[0];

      expect(where).toContain('IS NOT NULL');
      expect(where).toContain(`<> ''`);
    });
  });

  describe('quien no queda restringido', () => {
    it('el administrador ve todo', () => {
      expect(aplicar('factura', { kind: 'all' }, ['sociedadId'])).toHaveLength(0);
    });

    it('la propia tabla de accesos no se filtra a si misma', () => {
      expect(aplicar('accesoSociedad', ALGUNAS, ['sociedadId'])).toHaveLength(0);
    });

    it('los procesos internos del sistema no se filtran', () => {
      const { queryBuilder, llamadas } = construirQueryBuilder({
        objeto: 'factura',
        columnas: ['sociedadId'],
      });

      applyCompanyScope({
        queryBuilder,
        authContext: contexto(ALGUNAS),
        shouldBypassPermissionChecks: true,
      });

      expect(llamadas).toHaveLength(0);
    });

    // Un contexto de usuario sin scope resuelto no puede tratarse como "todo":
    // seria abrir los datos por un fallo de configuracion.
    it('un usuario sin scope resuelto no ve nada', () => {
      const llamadas = aplicar('factura', undefined, ['sociedadId']);

      expect(llamadas[0].where).toBe('1 = 0');
    });
  });
});
