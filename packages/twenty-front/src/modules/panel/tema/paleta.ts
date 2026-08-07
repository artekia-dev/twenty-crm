// Paleta del panel.
//
// Los graficos no usan los colores del tema del CRM. El tema esta pensado para
// texto y bordes, y al llevarlo a superficies grandes —una barra, un sector—
// los tonos se parecen demasiado entre si y el grafico deja de leerse de un
// vistazo, que es lo unico que se le pide a un panel.
//
// Cada serie tiene su color y NO se reparten por indice: compras y ventas
// siempre son el mismo color en todos los graficos del panel. Si el color
// cambiara de un grafico a otro habria que leer la leyenda cada vez.

export const COLORES = {
  compras: '#2563eb',
  ventas: '#0d9488',
  pendiente: '#f59e0b',
  aviso: '#dc2626',
  hecho: '#16a34a',
  neutro: '#94a3b8',
} as const;

export type NombreColor = keyof typeof COLORES;

// Serie para graficos de varias categorias (por sociedad, por buzon...), donde
// no hay un significado fijo por color. Ordenados para que dos contiguos se
// distingan tambien en escala de grises y por alguien con daltonismo: lo que
// cambia entre uno y el siguiente no es solo el tono, tambien la luminosidad.
export const SERIE_CATEGORIAS = [
  '#2563eb',
  '#0d9488',
  '#f59e0b',
  '#7c3aed',
  '#dc2626',
  '#0891b2',
  '#65a30d',
  '#db2777',
  '#475569',
  '#ca8a04',
] as const;

export const colorDeCategoria = (indice: number): string =>
  SERIE_CATEGORIAS[indice % SERIE_CATEGORIAS.length] as string;
