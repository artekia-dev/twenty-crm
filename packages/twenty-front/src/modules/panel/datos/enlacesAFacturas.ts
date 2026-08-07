import qs from 'qs';

// Enlaces del panel a la lista de facturas, ya filtrada.
//
// Un panel que solo enseña numeros deja el trabajo a medias: quien ve "9 con
// aviso" lo siguiente que quiere es ESAS nueve, y hoy tiene que ir a la lista,
// acordarse de que filtro poner y montarlo a mano. Cada cifra lleva a su lista.
//
// Se usa el mismo formato de filtros por URL que ya entiende la vista de
// registros (`?filter[campo][OPERANDO]=valor`), asi que el filtro llega
// aplicado y visible: quien aterriza ahi puede quitarlo, cambiarlo o guardarse
// la vista. Un filtro invisible seria peor que ninguno.

type FiltroUrl = Record<string, Record<string, string | string[]>>;

const enlace = (filtro: FiltroUrl): string =>
  `/objects/facturas?${qs.stringify({ filter: filtro }, { encode: true })}`;

/** Fecha en el formato que espera el filtro de la vista. */
const iso = (fecha: Date): string => fecha.toISOString();

export const enlaceFacturas = {
  todas: (desde: Date): string => enlace({ fechaEmision: { IS_AFTER: iso(desde) } }),

  porDireccion: (desde: Date, direccion: 'COMPRA' | 'VENTA'): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      direccion: { IS: [direccion] },
    }),

  sinContabilizar: (desde: Date): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      contabilizada: { IS: 'false' },
    }),

  sinPagar: (desde: Date): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      direccion: { IS: ['COMPRA'] },
      pagada: { IS: 'false' },
    }),

  conAvisoSociedad: (desde: Date): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      avisoSociedad: { IS_NOT_EMPTY: '' },
    }),

  conAvisoTipo: (desde: Date): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      avisoTipo: { IS_NOT_EMPTY: '' },
    }),

  sinSociedad: (desde: Date): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      sociedad: { IS_EMPTY: '' },
    }),

  sinDireccion: (desde: Date): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      direccion: { IS: ['DESCONOCIDA'] },
    }),

  /** Las de un proveedor. Por CIF si se conoce; si no, por el nombre leido. */
  deProveedor: (desde: Date, clave: { cif?: string; nombre?: string }): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      ...(clave.cif
        ? { cifEmisor: { IS: clave.cif } }
        : clave.nombre
          ? { contraparte: { IS: clave.nombre } }
          : {}),
    }),

  /** Las de una sociedad del grupo. */
  deSociedad: (desde: Date, sociedadId: string): string =>
    enlace({
      fechaEmision: { IS_AFTER: iso(desde) },
      sociedad: { IS: [sociedadId] },
    }),
};
