// Formato de importes y fechas del panel, en notacion espanola.
//
// El CRM abrevia los importes a "45k" cuando el campo no trae ajustes. En una
// lista eso ahorra sitio; en un panel destruye la informacion, porque 45k puede
// ser cualquier cosa entre 44.500 y 45.499 y estos numeros se leen para cuadrar
// un trimestre. Aqui se escribe el importe entero, con puntos de miles y coma
// decimal, que es como lo lee la persona que tiene la factura delante.

const EUROS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const EUROS_REDONDOS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const ENTERO = new Intl.NumberFormat('es-ES');

export const formatearEuros = (importe: number): string => EUROS.format(importe);

// Para ejes y etiquetas dentro del grafico, donde los centimos son ruido: no se
// leen para cuadrar nada, solo para comparar alturas.
export const formatearEurosCortos = (importe: number): string => {
  const abs = Math.abs(importe);

  if (abs >= 1_000_000) return `${ENTERO.format(Math.round(importe / 100_000) / 10)} M€`;
  if (abs >= 10_000) return `${ENTERO.format(Math.round(importe / 1_000))} mil €`;

  return EUROS_REDONDOS.format(importe);
};

export const formatearEntero = (valor: number): string => ENTERO.format(valor);

export const formatearPorcentaje = (parte: number, total: number): string => {
  if (total === 0) return '—';

  return `${ENTERO.format(Math.round((parte / total) * 100))} %`;
};

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** "2026-03" → "mar 26". El ano se pone siempre: un panel de 24 meses repite meses. */
export const etiquetaDeMes = (clave: string): string => {
  const [ano, mes] = clave.split('-');
  const indice = Number(mes) - 1;

  if (!ano || Number.isNaN(indice) || indice < 0 || indice > 11) return clave;

  return `${MESES_CORTOS[indice]} ${ano.slice(2)}`;
};
