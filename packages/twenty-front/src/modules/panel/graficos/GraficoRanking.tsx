import { css } from '@linaria/core';
import { styled } from '@linaria/react';
import { Link } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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
  /** Segunda linea: el NIF, o cuantas facturas son. Lo que aclare quien es. */
  detalle?: string;
  valor: number;
  color: string;
  /** A donde lleva la fila: sus facturas, ya filtradas. */
  enlace?: string;
};

type GraficoRankingProps = {
  filas: FilaRanking[];
  /** Se muestra el peso de cada fila sobre este total. Sin el, solo el importe. */
  total?: number;
};

const StyledLista = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledFila = styled.li`
  list-style: none;
`;

// La fila es un <a> cuando lleva a sus facturas y un <div> cuando no, asi que
// los estilos van en clases sueltas en vez de en dos componentes gemelos.
const contenidoFila = css`
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: inherit;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  /* Alto comodo para el dedo: 44px es el minimo que se acierta sin fallar. */
  min-height: 44px;
  justify-content: center;
  padding: ${themeCssVariables.spacing[1]};
  text-decoration: none;
  width: 100%;
`;

const contenidoPulsable = css`
  cursor: pointer;

  &:hover {
    background: ${themeCssVariables.background.transparent.lighter};
  }
`;

const StyledDetalleFila = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledCabecera = styled.div`
  align-items: baseline;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledNombre = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledImporte = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  white-space: nowrap;
`;

const StyledPeso = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-left: ${themeCssVariables.spacing[1]};
`;

const StyledCarril = styled.div`
  background: ${themeCssVariables.background.transparent.light};
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
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[4]} 0;
  text-align: center;
`;

export const GraficoRanking = ({ filas, total }: GraficoRankingProps) => {
  if (filas.length === 0) {
    return <StyledVacio>No hay datos en este periodo</StyledVacio>;
  }

  // La barra se mide contra el mayor de la lista, no contra el total: si una
  // sociedad se lleva el 90% las demas quedarian invisibles y el grafico no
  // diria nada de ellas. El peso real va escrito al lado en porcentaje.
  const mayor = Math.max(...filas.map((f) => Math.abs(f.valor)), 1);

  return (
    <StyledLista>
      {filas.map((fila) => {
        const cuerpo = (
          <>
              <StyledCabecera>
                <StyledNombre title={fila.nombre}>{fila.nombre}</StyledNombre>
                <StyledImporte>
                  {formatearEuros(fila.valor)}
                  {total !== undefined && total > 0 && (
                    <StyledPeso>{formatearPorcentaje(fila.valor, total)}</StyledPeso>
                  )}
                </StyledImporte>
              </StyledCabecera>
              {fila.detalle && <StyledDetalleFila>{fila.detalle}</StyledDetalleFila>}
              <StyledCarril>
                <StyledBarra
                  color={fila.color}
                  style={{ width: `${(Math.abs(fila.valor) / mayor) * 100}%` }}
                />
              </StyledCarril>
          </>
        );

        return (
          <StyledFila key={fila.id}>
            {fila.enlace ? (
              <Link to={fila.enlace} className={`${contenidoFila} ${contenidoPulsable}`}>
                {cuerpo}
              </Link>
            ) : (
              <div className={contenidoFila}>{cuerpo}</div>
            )}
          </StyledFila>
        );
      })}
    </StyledLista>
  );
};
