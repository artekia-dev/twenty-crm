import { styled } from '@linaria/react';

import { formatearEuros, formatearPorcentaje } from '@/panel/tema/formato';

// Ranking horizontal: una fila por sociedad, proveedor o buzon.
//
// Barras horizontales y no un grafico de tarta ni columnas verticales. En un
// movil un nombre de sociedad no cabe bajo una columna —"Comercializadora de
// Energia Directa" son 34 caracteres— y girarlo lo vuelve ilegible. En
// horizontal el nombre se lee normal, la barra crece hacia la derecha y caben
// tantas filas como haga falta con solo hacer scroll, que es el gesto natural.

export type FilaRanking = {
  id: string;
  nombre: string;
  valor: number;
  color: string;
};

type GraficoRankingProps = {
  filas: FilaRanking[];
  /** Se muestra el peso de cada fila sobre este total. Sin el, solo el importe. */
  total?: number;
  alPulsarFila?: (id: string) => void;
};

const StyledLista = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledFila = styled.li<{ pulsable: boolean }>`
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: ${({ pulsable }) => (pulsable ? 'pointer' : 'default')};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  /* Alto comodo para el dedo: 44px es el minimo que se acierta sin fallar. */
  min-height: 44px;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(1)};

  &:hover {
    background: ${({ theme, pulsable }) =>
      pulsable ? theme.background.transparent.lighter : 'transparent'};
  }
`;

const StyledCabecera = styled.div`
  align-items: baseline;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: space-between;
`;

const StyledNombre = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledImporte = styled.span`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  white-space: nowrap;
`;

const StyledPeso = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  margin-left: ${({ theme }) => theme.spacing(1)};
`;

const StyledCarril = styled.div`
  background: ${({ theme }) => theme.background.transparent.light};
  border-radius: 3px;
  height: 6px;
  overflow: hidden;
  width: 100%;
`;

const StyledBarra = styled.div<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 3px;
  height: 100%;
  transition: width 200ms ease-out;
`;

const StyledVacio = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(4)} 0;
  text-align: center;
`;

export const GraficoRanking = ({ filas, total, alPulsarFila }: GraficoRankingProps) => {
  if (filas.length === 0) {
    return <StyledVacio>No hay datos en este periodo</StyledVacio>;
  }

  // La barra se mide contra el mayor de la lista, no contra el total: si una
  // sociedad se lleva el 90% las demas quedarian invisibles y el grafico no
  // diria nada de ellas. El peso real va escrito al lado en porcentaje.
  const mayor = Math.max(...filas.map((f) => Math.abs(f.valor)), 1);

  return (
    <StyledLista>
      {filas.map((fila) => (
        <StyledFila
          key={fila.id}
          pulsable={Boolean(alPulsarFila)}
          onClick={() => alPulsarFila?.(fila.id)}
        >
          <StyledCabecera>
            <StyledNombre title={fila.nombre}>{fila.nombre}</StyledNombre>
            <StyledImporte>
              {formatearEuros(fila.valor)}
              {total !== undefined && total > 0 && (
                <StyledPeso>{formatearPorcentaje(fila.valor, total)}</StyledPeso>
              )}
            </StyledImporte>
          </StyledCabecera>
          <StyledCarril>
            <StyledBarra
              color={fila.color}
              style={{ width: `${(Math.abs(fila.valor) / mayor) * 100}%` }}
            />
          </StyledCarril>
        </StyledFila>
      ))}
    </StyledLista>
  );
};
