// Formato de importes y fechas del panel, en notacion espanola.
//
// El CRM abrevia los importes a "45k" cuando el campo no trae ajustes. En una
// lista eso ahorra sitio; en un panel destruye la informacion, porque 45k puede
// ser cualquier cosa entre 44.500 y 45.499 y estos numeros se leen para cuadrar
// un trimestre. Aqui se escribe el importe entero, con puntos de miles y coma
// decimal, que es como lo lee la persona que tiene la factura delante.

// `useGrouping: 'always'` porque es-ES no separa los miles en numeros de cuatro
// cifras: 2800 sale "2800,00 €" al lado de "1.250.230,38 €", y en una fila de
// cifras que se comparan de un vistazo esa incoherencia hace dudar del dato.
const EUROS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

const EUROS_REDONDOS = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const ENTERO = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });

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

/**
 * Marcas del eje de un grafico: valores redondos que se leen de cabeza.
 *
 * Repartir el maximo real en cuatro partes iguales deja el eje en 310 mil /
 * 621 mil / 931 mil: numeros exactos que no sirven para estimar. Lo que se
 * busca es un PASO redondo —1, 2, 2,5 o 5 por la potencia de diez que toque— y
 * luego tantas marcas como hagan falta para cubrir el maximo. Asi el eje sale
 * en 250 mil / 500 mil / 750 mil / 1 M y la altura de una barra se calcula
 * mirandola, que es para lo que esta el eje.
 */
export const escalaBonita = (maximo: number, divisionesDeseadas = 4): number[] => {
  if (!Number.isFinite(maximo) || maximo <= 0) return [];

  // Con importes por debajo de un euro la escala redondeada colapsa: las cuatro
  // marcas salen "1 €" repetido, que parece un fallo de pintado. Mejor una
  // sola marca honesta que cuatro iguales.
  if (maximo < 4) return [Math.max(1, Math.ceil(maximo))];

  const aproximado = maximo / divisionesDeseadas;
  const magnitud = 10 ** Math.floor(Math.log10(aproximado));
  const normalizado = aproximado / magnitud;

  const paso =
    (normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 2.5 ? 2.5 : normalizado <= 5 ? 5 : 10) *
    magnitud;

  const marcas: number[] = [];

  // Hasta cubrir el maximo. Puede salir una marca mas o una menos de las
  // pedidas: se prefiere eso a un eje con numeros que nadie sabe dividir.
  for (let valor = paso; marcas.length < 8; valor += paso) {
    marcas.push(valor);
    if (valor >= maximo) break;
  }

  return marcas;
};


/** "1 factura" / "3 facturas". El plural mal puesto delata que nadie lo miró. */
export const plural = (cantidad: number, singular: string, plural_: string): string =>
  `${formatearEntero(cantidad)} ${cantidad === 1 ? singular : plural_}`;
