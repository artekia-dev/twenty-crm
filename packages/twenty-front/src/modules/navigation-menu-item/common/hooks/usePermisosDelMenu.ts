import { useMemo } from 'react';

import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useHasPermissionFlag } from '@/settings/roles/hooks/useHasPermissionFlag';
import { type PermisosDelMenu } from '@/navigation-menu-item/common/utils/permisosDelMenu';
import { PermissionFlagType } from '~/generated-metadata/graphql';

type SociedadDelMenu = {
  __typename: string;
  id: string;
  codigo: string | null;
  veTodoElGrupo: boolean | null;
};

/**
 * A que sociedades tiene acceso quien esta mirando el menu.
 *
 * No hace falta preguntar por los accesos: las empresas ya llegan filtradas
 * por el servidor, asi que lo que devuelve esta consulta ES el permiso. Las
 * que llevan codigo interno son las sociedades del grupo; el resto son
 * proveedores y clientes, que no dan acceso a ningun panel.
 *
 * Mientras la consulta esta en vuelo no hay sociedades, asi que los paneles
 * aparecen un instante despues en vez de estar desde el principio. Es a
 * proposito: al reves —ensenarlos y quitarlos— se verian por un momento los
 * paneles de otras sociedades. Quien administra no lo nota, porque su permiso
 * sale del estado de la sesion y no de esta consulta.
 */
export const usePermisosDelMenu = (): PermisosDelMenu => {
  const esAdministrador = useHasPermissionFlag(PermissionFlagType.WORKSPACE);

  const { records } = useFindManyRecords<SociedadDelMenu>({
    objectNameSingular: 'company',
    recordGqlFields: { id: true, codigo: true, veTodoElGrupo: true },
    limit: 200,
  });

  return useMemo(() => {
    const delGrupo = records.filter(
      (empresa) => typeof empresa.codigo === 'string' && empresa.codigo.length > 0,
    );

    return {
      esAdministrador,
      veTodoElGrupo: delGrupo.some((empresa) => empresa.veTodoElGrupo === true),
      sociedadesVisibles: delGrupo.map((empresa) => empresa.id),
    };
  }, [records, esAdministrador]);
};
