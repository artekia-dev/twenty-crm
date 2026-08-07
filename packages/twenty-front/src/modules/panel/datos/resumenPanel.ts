import { euros, type FacturaPanel } from '@/panel/datos/usePanelFacturas';

// Los cortes del panel: cifras de cabecera, serie por mes y ranking.
//
// Aparte de los componentes a proposito. Un total mal sumado en un panel no se
// nota —el numero sale, parece razonable y nadie lo comprueba— asi que estas
// funciones son puras y tienen pruebas. La UI solo las pinta.

export type Resumen = {
  compras: number;
  ventas: number;
  numeroFacturas: number;
  pendientesDeContabilizar: number;
  importePendiente: number;
  pendientesDePago: number;
  importePendienteDePago: number;
  conAvisoSociedad: number;
  conAvisoTipo: number;
  sinSociedad: number;
  sinDireccion: number;
};

export type PuntoMes = {
  mes: string;
  compras: number;
  ventas: number;
};

const esCompra = (f: FacturaPanel) => f.direccion === 'COMPRA';
const esVenta = (f: FacturaPanel) => f.direccion === 'VENTA';

/**
 * El importe de una factura, con o sin IVA.
 *
 * Son dos preguntas distintas y las dos se hacen a diario: la base imponible es
 * lo que se compara entre periodos y lo que va al modelo de IVA; el total es lo
 * que de verdad sale o entra de la cuenta. Mezclarlas en la misma pantalla hace
 * que las cifras parezcan contradecirse, asi que el panel entero se mira en una
 * u otra magnitud, nunca en las dos a la vez.
 *
 * Si el importe que toca no esta, se usa el otro: media cifra es mejor que un
 * cero, que ademas se confunde con "no hay nada".
 */
export const importeDe = (f: FacturaPanel, conIva: boolean): number => {
  const base = euros(f.base);
  const total = euros(f.total);

  if (conIva) return total > 0 ? total : base + euros(f.iva);

  return base > 0 ? base : total;
};

export const calcularResumen = (facturas: FacturaPanel[], conIva: boolean): Resumen => {
  const resumen: Resumen = {
    compras: 0,
    ventas: 0,
    numeroFacturas: facturas.length,
    pendientesDeContabilizar: 0,
    importePendiente: 0,
    pendientesDePago: 0,
    importePendienteDePago: 0,
    conAvisoSociedad: 0,
    conAvisoTipo: 0,
    sinSociedad: 0,
    sinDireccion: 0,
  };

  for (const factura of facturas) {
    const importe = importeDe(factura, conIva);

    if (esCompra(factura)) resumen.compras += importe;
    if (esVenta(factura)) resumen.ventas += importe;

    if (factura.contabilizada !== true) {
      resumen.pendientesDeContabilizar += 1;
      resumen.importePendiente += importeDe(factura, conIva);
    }

    // Solo las compras: una venta sin pagar es un cobro pendiente y se mira en
    // otro sitio. Aqui se responde "cuanto debemos".
    if (esCompra(factura) && factura.pagada !== true) {
      resumen.pendientesDePago += 1;
      resumen.importePendienteDePago += importeDe(factura, conIva);
    }

    // Contados por separado y no en un solo "con aviso": cada cifra del panel
    // lleva a una lista filtrada, y una cifra que suma dos filtros distintos
    // nunca coincide con el numero de filas que aparecen al pulsarla. La
    // primera vez que eso pasa, deja de creerse el panel entero.
    if (factura.avisoSociedad !== null) resumen.conAvisoSociedad += 1;
    if (factura.avisoTipo !== null) resumen.conAvisoTipo += 1;

    if (factura.sociedadId === null) resumen.sinSociedad += 1;

    if (factura.direccion === null || factura.direccion === 'DESCONOCIDA') {
      resumen.sinDireccion += 1;
    }
  }

  return resumen;
};

/**
 * Serie por mes, con los meses vacios incluidos.
 *
 * Sin los huecos el grafico miente: dos meses contiguos en la barra pueden
 * estar separados por medio ano sin actividad, y la linea parece continua.
 */
export const calcularSerieMensual = (
  facturas: FacturaPanel[],
  desde: Date,
  hasta: Date,
  conIva: boolean,
): PuntoMes[] => {
  const porMes = new Map<string, PuntoMes>();

  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);

  while (cursor <= hasta) {
    const clave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;

    porMes.set(clave, { mes: clave, compras: 0, ventas: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  for (const factura of facturas) {
    if (factura.fechaEmision === null) continue;

    const fecha = new Date(factura.fechaEmision);

    if (Number.isNaN(fecha.getTime())) continue;

    const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    const punto = porMes.get(clave);

    if (!punto) continue;

    const importe = importeDe(factura, conIva);

    if (esCompra(factura)) punto.compras += importe;
    if (esVenta(factura)) punto.ventas += importe;
  }

  return [...porMes.values()];
};

export type OrdenRanking = 'importe' | 'documentos' | 'nombre';

export type FilaAgrupada = {
  id: string;
  nombre: string;
  importe: number;
  documentos: number;
};

/** Agrupa por una clave de texto (sociedad, proveedor) y ordena como se pida. */
export const agruparPor = (
  facturas: FacturaPanel[],
  clave: (f: FacturaPanel) => { id: string; nombre: string } | null,
  orden: OrdenRanking,
  conIva: boolean,
): FilaAgrupada[] => {
  const grupos = new Map<string, FilaAgrupada>();

  for (const factura of facturas) {
    const k = clave(factura);

    if (!k) continue;

    const grupo = grupos.get(k.id) ?? {
      id: k.id,
      nombre: k.nombre,
      importe: 0,
      documentos: 0,
    };

    grupo.importe += importeDe(factura, conIva);
    grupo.documentos += 1;
    grupos.set(k.id, grupo);
  }

  const filas = [...grupos.values()];

  if (orden === 'nombre') {
    return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  if (orden === 'documentos') {
    return filas.sort((a, b) => b.documentos - a.documentos);
  }

  return filas.sort((a, b) => b.importe - a.importe);
};

/**
 * IVA del periodo, separado por direccion.
 *
 * Es la cifra que se lleva al modelo trimestral y no estaba en ningun sitio del
 * panel: habia que abrir la lista, filtrar y sumar a mano. Soportado es el de
 * las compras (se deduce), repercutido el de las ventas (se ingresa), y la
 * diferencia es lo que sale a pagar o a devolver.
 */
export type ResumenIva = {
  soportado: number;
  repercutido: number;
  diferencia: number;
};

export const calcularIva = (facturas: FacturaPanel[]): ResumenIva => {
  let soportado = 0;
  let repercutido = 0;

  for (const factura of facturas) {
    const iva = euros(factura.iva);

    if (esCompra(factura)) soportado += iva;
    if (esVenta(factura)) repercutido += iva;
  }

  return { soportado, repercutido, diferencia: repercutido - soportado };
};

export type TramoAntiguedad = {
  id: string;
  etiqueta: string;
  documentos: number;
  importe: number;
};

/**
 * Cuanto lleva esperando lo que no se ha contabilizado.
 *
 * "62 facturas sin contabilizar" no dice si son de esta semana o llevan medio
 * ano ahi. Lo primero es normal; lo segundo es un problema, y hasta ahora solo
 * se veia abriendo la lista y mirando fechas una a una.
 */
export const calcularAntiguedad = (
  facturas: FacturaPanel[],
  hoy: Date,
  conIva: boolean,
): TramoAntiguedad[] => {
  const tramos: TramoAntiguedad[] = [
    { id: 'reciente', etiqueta: 'Menos de 30 días', documentos: 0, importe: 0 },
    { id: 'medio', etiqueta: 'De 30 a 90 días', documentos: 0, importe: 0 },
    { id: 'viejo', etiqueta: 'Más de 90 días', documentos: 0, importe: 0 },
    { id: 'sinFecha', etiqueta: 'Sin fecha', documentos: 0, importe: 0 },
  ];

  const meter = (indice: number, factura: FacturaPanel) => {
    const tramo = tramos[indice];

    if (!tramo) return;

    tramo.documentos += 1;
    tramo.importe += importeDe(factura, conIva);
  };

  for (const factura of facturas) {
    if (factura.contabilizada === true) continue;

    if (factura.fechaEmision === null) {
      meter(3, factura);
      continue;
    }

    const fecha = new Date(factura.fechaEmision);

    if (Number.isNaN(fecha.getTime())) {
      meter(3, factura);
      continue;
    }

    const dias = Math.floor((hoy.getTime() - fecha.getTime()) / 86_400_000);

    meter(dias < 30 ? 0 : dias < 90 ? 1 : 2, factura);
  }

  return tramos.filter((t) => t.documentos > 0);
};
