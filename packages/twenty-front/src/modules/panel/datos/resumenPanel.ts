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
  conAviso: number;
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

/** La base imponible, que es lo que se compara entre periodos. Sin ella, el total. */
export const importeDe = (f: FacturaPanel): number => {
  const base = euros(f.base);

  return base > 0 ? base : euros(f.total);
};

export const calcularResumen = (facturas: FacturaPanel[]): Resumen => {
  const resumen: Resumen = {
    compras: 0,
    ventas: 0,
    numeroFacturas: facturas.length,
    pendientesDeContabilizar: 0,
    importePendiente: 0,
    pendientesDePago: 0,
    importePendienteDePago: 0,
    conAviso: 0,
    sinSociedad: 0,
    sinDireccion: 0,
  };

  for (const factura of facturas) {
    const importe = importeDe(factura);

    if (esCompra(factura)) resumen.compras += importe;
    if (esVenta(factura)) resumen.ventas += importe;

    if (factura.contabilizada !== true) {
      resumen.pendientesDeContabilizar += 1;
      resumen.importePendiente += euros(factura.total);
    }

    // Solo las compras: una venta sin pagar es un cobro pendiente y se mira en
    // otro sitio. Aqui se responde "cuanto debemos".
    if (esCompra(factura) && factura.pagada !== true) {
      resumen.pendientesDePago += 1;
      resumen.importePendienteDePago += euros(factura.total);
    }

    if (factura.avisoSociedad !== null || factura.avisoTipo !== null) {
      resumen.conAviso += 1;
    }

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

    const importe = importeDe(factura);

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

    grupo.importe += importeDe(factura);
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
