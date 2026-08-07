import qs from 'qs';

// Enlaces del panel a la lista de facturas, ya filtrada.
//
// Un panel que solo ensena numeros deja el trabajo a medias: quien ve "9 con
// aviso" lo siguiente que quiere es ESAS nueve, y sin esto tiene que ir a la
// lista, acordarse de que filtro poner y montarlo a mano.
//
// Se usa el formato de filtros por URL que ya entiende la vista de registros
// (`?filter[campo][OPERANDO]=valor`), asi que el filtro llega aplicado y
// VISIBLE: quien aterriza ahi puede quitarlo, cambiarlo o guardarse la vista.
// Un filtro invisible seria peor que ninguno.

type FiltroUrl = Record<string, Record<string, string | string[]>>;

export type ContextoEnlaces = {
  desde: Date;
  /** El panel de una sociedad; ausente en el del grupo. */
  sociedadId?: string;
};

/**
 * Los enlaces de un panel concreto.
 *
 * El contexto se pasa al construirlos y no vive en el modulo: el panel de una
 * sociedad y el del grupo pueden existir a la vez, y un estado compartido haria
 * que uno se llevara los filtros del otro. Ademas, sin la sociedad en el
 * enlace, pulsar una cifra del panel de Orzaga llevaria a las facturas de todo
 * el grupo, y el numero de la pantalla no cuadraria con el de la lista.
 */
export const enlacesDePanel = ({ desde, sociedadId }: ContextoEnlaces) => {
  const iso = desde.toISOString();

  const enlace = (filtro: FiltroUrl): string =>
    `/objects/facturas?${qs.stringify(
      {
        filter: {
          fechaEmision: { IS_AFTER: iso },
          ...(sociedadId ? { sociedad: { IS: [sociedadId] } } : {}),
          ...filtro,
        },
      },
      { encode: true },
    )}`;

  return {
    todas: (): string => enlace({}),

    porDireccion: (direccion: 'COMPRA' | 'VENTA'): string =>
      enlace({ direccion: { IS: [direccion] } }),

    sinContabilizar: (): string => enlace({ contabilizada: { IS: 'false' } }),

    /** La bandeja: lo que falta por comprobar, y por eso no suma en el panel. */
    sinValidar: (): string => enlace({ validada: { IS: 'false' } }),

    sinPagar: (): string =>
      enlace({ direccion: { IS: ['COMPRA'] }, pagada: { IS: 'false' } }),

    conAvisoSociedad: (): string => enlace({ avisoSociedad: { IS_NOT_EMPTY: '' } }),

    conAvisoTipo: (): string => enlace({ avisoTipo: { IS_NOT_EMPTY: '' } }),

    sinSociedad: (): string => enlace({ sociedad: { IS_EMPTY: '' } }),

    sinDireccion: (): string => enlace({ direccion: { IS: ['DESCONOCIDA'] } }),

    /** Las de un proveedor. Por CIF si se conoce; si no, por el nombre leido. */
    deProveedor: (clave: { cif?: string; nombre?: string }): string =>
      enlace(
        clave.cif
          ? { cifEmisor: { IS: clave.cif } }
          : clave.nombre
            ? { contraparte: { IS: clave.nombre } }
            : {},
      ),

    /** Las de una sociedad concreta: cada fila del reparto del grupo. */
    deSociedad: (id: string): string => enlace({ sociedad: { IS: [id] } }),
  };
};

export type EnlacesDePanel = ReturnType<typeof enlacesDePanel>;
