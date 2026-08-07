import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useState } from 'react';

import { useAnchoContenedor } from '@/panel/hooks/useAnchoContenedor';
import {
  escalaBonita,
  etiquetaDeMes,
  formatearEuros,
  formatearEurosCortos,
} from '@/panel/tema/formato';
import { COLORES } from '@/panel/tema/paleta';

// Compras y ventas por mes.
//
// Dibujado a mano en SVG y no con una libreria de graficos porque lo que hace
// falta no es un grafico de escritorio: es uno que se lea en un movil sostenido
// con una mano. Eso son tres decisiones que una libreria generica no toma bien:
// el area sensible es la columna del mes entera y no una barra de ocho pixeles,
// el detalle sale al TOCAR porque en un movil no hay raton que pasar por
// encima, y del eje solo se pintan las etiquetas que caben de verdad.

export type PuntoMes = {
  mes: string;
  compras: number;
  ventas: number;
};

type GraficoMesesProps = {
  datos: PuntoMes[];
  mostrarCompras: boolean;
  mostrarVentas: boolean;
};

const ALTO = 240;
const ALTO_EJE = 24;
const ANCHO_MINIMO_ETIQUETA = 52;
// Sitio para el eje vertical. Sin el, las barras solo dicen cual es mayor que
// cual: no se sabe si la mas alta son diez mil euros o un millon, y eso es lo
// primero que pregunta quien mira el grafico.
const ANCHO_EJE_Y = 62;

const StyledContenedor = styled.div`
  position: relative;
  width: 100%;
`;

const StyledEtiquetaEje = styled.text`
  fill: ${themeCssVariables.font.color.tertiary};
  font-size: 11px;
`;

const StyledZonaTactil = styled.rect`
  cursor: pointer;
  fill: transparent;
`;

const StyledFondoMes = styled.rect`
  fill: ${themeCssVariables.background.transparent.light};
`;

const StyledLineaGuia = styled.line`
  stroke: ${themeCssVariables.border.color.light};
  stroke-dasharray: 3 3;
`;

const StyledGlobo = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.light};
  padding: ${themeCssVariables.spacing[2]};
  pointer-events: none;
  position: absolute;
  top: 0;
  width: 168px;
  z-index: 2;
`;

const StyledGloboMes = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-bottom: ${themeCssVariables.spacing[1]};
  text-transform: capitalize;
`;

const StyledGloboFila = styled.div`
  align-items: center;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledEtiquetaSerie = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledPunto = styled.span<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 2px;
  display: inline-block;
  height: 8px;
  width: 8px;
`;

const StyledVacio = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  height: ${ALTO}px;
  justify-content: center;
`;

export const GraficoMeses = ({
  datos,
  mostrarCompras,
  mostrarVentas,
}: GraficoMesesProps) => {
  const { ref, ancho } = useAnchoContenedor<HTMLDivElement>();
  const [mesActivo, setMesActivo] = useState<number | null>(null);

  const series = [
    ...(mostrarCompras ? [{ clave: 'compras' as const, color: COLORES.compras }] : []),
    ...(mostrarVentas ? [{ clave: 'ventas' as const, color: COLORES.ventas }] : []),
  ];

  const maximo = Math.max(
    ...datos.flatMap((d) => [
      mostrarCompras ? d.compras : 0,
      mostrarVentas ? d.ventas : 0,
    ]),
    1,
  );

  const altoUtil = ALTO - ALTO_EJE;
  const anchoGrafico = Math.max(ancho - ANCHO_EJE_Y, 0);
  const anchoMes = datos.length > 0 ? anchoGrafico / datos.length : 0;
  const alturaDe = (valor: number) => (valor / (marcas.at(-1) ?? maximo)) * (altoUtil - 12);

  // Cuantas etiquetas caben de verdad. Con 24 meses en un movil solo entran
  // tres o cuatro; pintarlas todas las deja ilegibles y pisadas.
  const salto = Math.max(1, Math.ceil(ANCHO_MINIMO_ETIQUETA / Math.max(anchoMes, 1)));
  const marcas = escalaBonita(maximo);
  // Las barras se miden contra el tope redondo del eje, no contra el maximo
  // real, o la barra mas alta tocaria el techo y no cuadraria con su marca.
  const tope = marcas.at(-1) ?? maximo;
  const activo = mesActivo !== null ? datos[mesActivo] : undefined;

  if (datos.length === 0 || series.length === 0) {
    return (
      <StyledContenedor ref={ref}>
        <StyledVacio>
          {series.length === 0
            ? 'Activa compras o ventas para ver el gráfico'
            : 'No hay movimientos en este periodo'}
        </StyledVacio>
      </StyledContenedor>
    );
  }

  return (
    <StyledContenedor ref={ref}>
      {ancho > 0 && (
        <svg width={ancho} height={ALTO} role="img" aria-label="Compras y ventas por mes">
          {marcas.map((marca) => {
            const y = altoUtil - alturaDe(marca);

            return (
              <g key={marca}>
                <StyledLineaGuia x1={ANCHO_EJE_Y} x2={ancho} y1={y} y2={y} />
                <StyledEtiquetaEje x={ANCHO_EJE_Y - 8} y={y + 4} textAnchor="end">
                  {formatearEurosCortos(marca)}
                </StyledEtiquetaEje>
              </g>
            );
          })}

          {datos.map((punto, indice) => {
            const x0 = ANCHO_EJE_Y + indice * anchoMes;
            const anchoBarra = (anchoMes * 0.6) / series.length;
            const sobra = anchoMes - anchoBarra * series.length;

            return (
              <g key={punto.mes}>
                {mesActivo === indice && (
                  <StyledFondoMes x={x0} y={0} width={anchoMes} height={altoUtil} />
                )}

                {series.map((serie, s) => {
                  const valor = punto[serie.clave];
                  const alto = alturaDe(valor);

                  return (
                    <rect
                      key={serie.clave}
                      x={x0 + sobra / 2 + s * anchoBarra}
                      y={altoUtil - alto}
                      width={Math.max(anchoBarra - 2, 1)}
                      height={valor > 0 ? Math.max(alto, 2) : 0}
                      fill={serie.color}
                      rx={2}
                    />
                  );
                })}

                <StyledZonaTactil
                  x={x0}
                  y={0}
                  width={anchoMes}
                  height={altoUtil}
                  onMouseEnter={() => setMesActivo(indice)}
                  onMouseLeave={() => setMesActivo(null)}
                  onClick={() => setMesActivo(mesActivo === indice ? null : indice)}
                />

                {indice % salto === 0 && (
                  <StyledEtiquetaEje
                    x={x0 + anchoMes / 2}
                    y={ALTO - 7}
                    textAnchor="middle"
                  >
                    {etiquetaDeMes(punto.mes)}
                  </StyledEtiquetaEje>
                )}
              </g>
            );
          })}
        </svg>
      )}

      {activo && (
        <StyledGlobo
          style={{
            left: Math.min(
              Math.max(0, ANCHO_EJE_Y + (mesActivo ?? 0) * anchoMes + anchoMes / 2 - 84),
              Math.max(0, ancho - 168),
            ),
          }}
        >
          <StyledGloboMes>{etiquetaDeMes(activo.mes)}</StyledGloboMes>
          {mostrarCompras && (
            <StyledGloboFila>
              <StyledEtiquetaSerie>
                <StyledPunto color={COLORES.compras} /> Compras
              </StyledEtiquetaSerie>
              <strong>{formatearEuros(activo.compras)}</strong>
            </StyledGloboFila>
          )}
          {mostrarVentas && (
            <StyledGloboFila>
              <StyledEtiquetaSerie>
                <StyledPunto color={COLORES.ventas} /> Ventas
              </StyledEtiquetaSerie>
              <strong>{formatearEuros(activo.ventas)}</strong>
            </StyledGloboFila>
          )}
        </StyledGlobo>
      )}
    </StyledContenedor>
  );
};
