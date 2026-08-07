// Que entradas del menu ve cada persona.
//
// Esto NO es lo que protege los datos: de eso se encarga el servidor, que
// filtra por sociedad en cada consulta. Aqui se quitan los enlaces que no
// llevarian a ninguna parte, porque un menu con veinte paneles de los que
// diecinueve salen vacios no es un menu, es una trampa.

/** Los objetos que solo tienen sentido para quien administra el sistema. */
export const OBJETOS_DE_ADMINISTRACION = ['workspaceMember', 'timelineActivity'];

export type PermisosDelMenu = {
  esAdministrador: boolean;
  /** Quien pertenece a la holding ve todas las sociedades, y el panel general. */
  veTodoElGrupo: boolean;
  /** Los ids de las sociedades a las que tiene acceso. */
  sociedadesVisibles: string[];
};

const PANEL_DEL_GRUPO = '/panel/holding';
const PANEL_DE_SOCIEDAD = /^\/panel\/sociedad\/(.+)$/;

/**
 * Si un enlace del menu lleva a un panel que esta persona puede ver.
 *
 * Solo decide sobre los enlaces de panel; cualquier otro enlace pasa. Devolver
 * `false` por defecto escondería enlaces que no tienen nada que ver con las
 * sociedades —la documentación, un enlace externo— y el menu se vaciaria solo
 * segun se anadan cosas.
 */
export const enlacePermitido = (
  enlace: string | null | undefined,
  { esAdministrador, veTodoElGrupo, sociedadesVisibles }: PermisosDelMenu,
): boolean => {
  if (typeof enlace !== 'string') return true;

  const limpio = enlace.trim();

  if (esAdministrador) return true;

  if (limpio === PANEL_DEL_GRUPO) return veTodoElGrupo;

  const sociedad = PANEL_DE_SOCIEDAD.exec(limpio);

  if (!sociedad) return true;

  // Quien ve el grupo entero ve tambien el panel de cada sociedad, aunque no
  // tenga un acceso apuntando a cada una de ellas.
  if (veTodoElGrupo) return true;

  return sociedadesVisibles.includes(sociedad[1]);
};

/** Si un objeto del menu solo lo ve quien administra. */
export const objetoPermitido = (
  nombreDelObjeto: string | null | undefined,
  { esAdministrador }: PermisosDelMenu,
): boolean => {
  if (typeof nombreDelObjeto !== 'string') return true;

  if (!OBJETOS_DE_ADMINISTRACION.includes(nombreDelObjeto)) return true;

  return esAdministrador;
};
