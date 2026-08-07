import { useMemo } from 'react';

import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';

// Los datos del panel, en UNA consulta.
//
// El panel viejo hacia una consulta por widget: setenta y ocho peticiones para
// pintar una pagina, y cada corte de los datos —por mes, por sociedad, por
// estado— era un widget mas con su consulta. Aqui se piden las facturas del
// periodo una vez y todos los cortes salen de ellas en memoria.
//
// Esto vale porque el periodo acota el volumen: un ejercicio del grupo son
// miles de filas, no millones. Si algun dia deja de valer, el sintoma sera
// claro (la pagina tarda) y el arreglo tambien: mover los cortes a
// agregaciones de servidor, que ya existen en el CRM.
//
// Las facturas llegan por la capa normal del CRM, asi que el scope por sociedad
// se aplica solo: quien no ve una sociedad tampoco la ve sumada aqui.

export type FacturaPanel = {
  id: string;
  fechaEmision: string | null;
  direccion: 'COMPRA' | 'VENTA' | 'DESCONOCIDA' | null;
  contabilizada: boolean | null;
  pagada: boolean | null;
  conciliada: boolean | null;
  estadoExtraccion: string | null;
  avisoSociedad: string | null;
  avisoTipo: string | null;
  contraparte: string | null;
  sociedadId: string | null;
  base: { amountMicros: number | null } | null;
  iva: { amountMicros: number | null } | null;
  total: { amountMicros: number | null } | null;
};

const CAMPOS = {
  id: true,
  fechaEmision: true,
  direccion: true,
  contabilizada: true,
  pagada: true,
  conciliada: true,
  estadoExtraccion: true,
  avisoSociedad: true,
  avisoTipo: true,
  contraparte: true,
  sociedadId: true,
  base: true,
  iva: true,
  total: true,
};

export type Periodo = '3m' | '12m' | '24m' | 'ejercicio';

export const ETIQUETAS_PERIODO: Record<Periodo, string> = {
  '3m': 'Últimos 3 meses',
  '12m': 'Últimos 12 meses',
  '24m': 'Últimos 24 meses',
  ejercicio: 'Este ejercicio',
};

/** Primer dia del periodo, en ISO. El ejercicio se toma como el ano natural. */
export const inicioDelPeriodo = (periodo: Periodo, hoy: Date): Date => {
  if (periodo === 'ejercicio') return new Date(hoy.getFullYear(), 0, 1);

  const meses = periodo === '3m' ? 3 : periodo === '12m' ? 12 : 24;

  return new Date(hoy.getFullYear(), hoy.getMonth() - (meses - 1), 1);
};

export const usePanelFacturas = (periodo: Periodo) => {
  const desde = useMemo(() => inicioDelPeriodo(periodo, new Date()), [periodo]);

  const { records, loading, error } = useFindManyRecords<FacturaPanel>({
    // Objeto a medida del fork: no esta en el enum de objetos estandar.
    objectNameSingular: 'factura',
    filter: { fechaEmision: { gte: desde.toISOString() } },
    recordGqlFields: CAMPOS,
    limit: 1000,
  });

  return { facturas: records, cargando: loading, error, desde };
};

/** Euros a partir del campo de importe del CRM, que viaja en micros. */
export const euros = (importe: { amountMicros: number | null } | null): number =>
  (importe?.amountMicros ?? 0) / 1_000_000;
