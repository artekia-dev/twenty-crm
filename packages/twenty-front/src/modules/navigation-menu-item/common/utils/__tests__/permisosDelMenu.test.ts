import {
  enlacePermitido,
  objetoPermitido,
  type PermisosDelMenu,
} from '@/navigation-menu-item/common/utils/permisosDelMenu';

// Un menu con veinte paneles de los que diecinueve salen vacios no es un menu,
// es una trampa: quien lo usa no sabe si el panel esta vacio porque no hay
// facturas o porque no es suyo.

const ORZAGA = 'soc-orzaga';
const VALDEMARIN = 'soc-valdemarin';

const permisos = (over: Partial<PermisosDelMenu> = {}): PermisosDelMenu => ({
  esAdministrador: false,
  veTodoElGrupo: false,
  sociedadesVisibles: [ORZAGA],
  ...over,
});

describe('enlacePermitido', () => {
  it('deja ver el panel de su sociedad', () => {
    expect(enlacePermitido(`/panel/sociedad/${ORZAGA}`, permisos())).toBe(true);
  });

  it('esconde el panel de una sociedad que no es suya', () => {
    expect(enlacePermitido(`/panel/sociedad/${VALDEMARIN}`, permisos())).toBe(false);
  });

  it('esconde el panel del grupo a quien solo tiene una sociedad', () => {
    expect(enlacePermitido('/panel/holding', permisos())).toBe(false);
  });

  describe('quien pertenece a la holding', () => {
    const holding = permisos({ veTodoElGrupo: true });

    it('ve el panel del grupo', () => {
      expect(enlacePermitido('/panel/holding', holding)).toBe(true);
    });

    // Ve el grupo entero, asi que ve cada sociedad — aunque no tenga un acceso
    // apuntando a cada una de ellas, que es como esta montado en la practica.
    it('ve el panel de cualquier sociedad', () => {
      expect(enlacePermitido(`/panel/sociedad/${VALDEMARIN}`, holding)).toBe(true);
    });
  });

  it('el administrador lo ve todo', () => {
    const admin = permisos({ esAdministrador: true, sociedadesVisibles: [] });

    expect(enlacePermitido('/panel/holding', admin)).toBe(true);
    expect(enlacePermitido(`/panel/sociedad/${VALDEMARIN}`, admin)).toBe(true);
  });

  // Esconder por defecto vaciaria el menu solo, segun se anadan enlaces que no
  // tienen nada que ver con las sociedades.
  describe('lo que no es un panel', () => {
    it.each([
      ['un enlace externo', 'https://docs.cfaryc.es'],
      ['otra ruta interna', '/settings/profile'],
      ['una ruta parecida pero no', '/panel/holdings'],
      ['sin enlace', null],
      ['sin definir', undefined],
    ])('deja pasar %s', (_caso, enlace) => {
      expect(enlacePermitido(enlace, permisos())).toBe(true);
    });
  });
});

describe('objetoPermitido', () => {
  it.each(['workspaceMember', 'timelineActivity'])(
    'esconde %s a quien no administra',
    (objeto) => {
      expect(objetoPermitido(objeto, permisos())).toBe(false);
    },
  );

  it.each(['workspaceMember', 'timelineActivity'])(
    'se lo ensena al administrador: %s',
    (objeto) => {
      expect(objetoPermitido(objeto, permisos({ esAdministrador: true }))).toBe(true);
    },
  );

  it.each([
    ['factura', 'factura'],
    ['albaran', 'albaran'],
    ['correo procesado', 'correoProcesado'],
    ['sin objeto', null],
  ])('deja pasar %s', (_caso, objeto) => {
    expect(objetoPermitido(objeto, permisos())).toBe(true);
  });
});
