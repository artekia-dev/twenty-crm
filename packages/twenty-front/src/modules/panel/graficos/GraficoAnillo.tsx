import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useState } from 'react';

import { formatearEntero, formatearPorcentaje } from '@/panel/tema/formato';

// Anillo para repartos de pocas categorias: en que estado esta el circuito.
//
// Anillo y no tarta porque el hueco del centro sirve para lo que de verdad
// importa —el total, y el detalle de lo que se esta tocando— sin robarle sitio
// al grafico. En un movil eso ahorra una linea de texto debajo, que es
// exactamente lo que hace que un panel entre en pantalla o no.

export type SectorAnillo = {
  id: string;
  etiqueta: string;
  valor: number;
  color: string;
};

type GraficoAnilloProps = {
  sectores: SectorAnillo[];
  /** Se escribe en el centro cuando no se esta tocando ningun sector. */
  leyendaCentro: string;
};

const TAMANO = 168;
const GROSOR = 22;

const StyledContenedor = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: center;
`;

const StyledLienzo = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const StyledCentro = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  inset: 0;
  justify-content: center;
  pointer-events: none;
  position: absolute;
  text-align: center;
`;

const StyledCentroValor = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.1;
`;

const StyledCentroEtiqueta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: 2px;
  max-width: ${TAMANO - GROSOR * 2 - 8}px;
`;

const StyledLeyenda = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  list-style: none;
  margin: 0;
  min-width: 160px;
  padding: 0;
`;

const StyledLeyendaFila = styled.li`
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  min-height: 32px;
`;

const StyledLeyendaNombre = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledPunto = styled.span<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
  height: 10px;
  width: 10px;
`;

const StyledLeyendaValor = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledVacio = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[6]} 0;
  text-align: center;
  width: 100%;
`;

const puntoEnCirculo = (angulo: number, radio: number) => ({
  x: TAMANO / 2 + radio * Math.cos(angulo - Math.PI / 2),
  y: TAMANO / 2 + radio * Math.sin(angulo - Math.PI / 2),
});

const arco = (desde: number, hasta: number, radio: number, radioInterior: number) => {
  const largo = hasta - desde > Math.PI ? 1 : 0;
  const e1 = puntoEnCirculo(desde, radio);
  const e2 = puntoEnCirculo(hasta, radio);
  const i1 = puntoEnCirculo(hasta, radioInterior);
  const i2 = puntoEnCirculo(desde, radioInterior);

  return [
    `M ${e1.x} ${e1.y}`,
    `A ${radio} ${radio} 0 ${largo} 1 ${e2.x} ${e2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${radioInterior} ${radioInterior} 0 ${largo} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
};

export const GraficoAnillo = ({ sectores, leyendaCentro }: GraficoAnilloProps) => {
  const [activo, setActivo] = useState<string | null>(null);

  const conValor = sectores.filter((s) => s.valor > 0);
  const total = conValor.reduce((suma, s) => suma + s.valor, 0);

  if (total === 0) {
    return <StyledVacio>Nada que mostrar todavía</StyledVacio>;
  }

  const radio = TAMANO / 2;
  const radioInterior = radio - GROSOR;
  const sectorActivo = conValor.find((s) => s.id === activo);

  let anguloAcumulado = 0;

  return (
    <StyledContenedor>
      <StyledLienzo>
        <svg width={TAMANO} height={TAMANO} role="img" aria-label="Reparto por estado">
          {conValor.map((sector) => {
            const desde = anguloAcumulado;
            // Un hueco minimo entre sectores para que se distingan aunque dos
            // colores contiguos se parezcan al imprimir o en blanco y negro.
            const angulo = (sector.valor / total) * Math.PI * 2;
            const hasta = desde + Math.max(angulo - 0.012, 0.004);

            anguloAcumulado += angulo;

            const atenuado = activo !== null && activo !== sector.id;

            return (
              <path
                key={sector.id}
                d={arco(desde, hasta, radio, radioInterior)}
                fill={sector.color}
                opacity={atenuado ? 0.28 : 1}
                onMouseEnter={() => setActivo(sector.id)}
                onMouseLeave={() => setActivo(null)}
                onClick={() => setActivo(activo === sector.id ? null : sector.id)}
                style={{ cursor: 'pointer', transition: 'opacity 150ms' }}
              />
            );
          })}
        </svg>
        <StyledCentro>
          <StyledCentroValor>
            {formatearEntero(sectorActivo ? sectorActivo.valor : total)}
          </StyledCentroValor>
          <StyledCentroEtiqueta>
            {sectorActivo ? sectorActivo.etiqueta : leyendaCentro}
          </StyledCentroEtiqueta>
        </StyledCentro>
      </StyledLienzo>

      <StyledLeyenda>
        {conValor.map((sector) => (
          <StyledLeyendaFila
            key={sector.id}
            onMouseEnter={() => setActivo(sector.id)}
            onMouseLeave={() => setActivo(null)}
            onClick={() => setActivo(activo === sector.id ? null : sector.id)}
          >
            <StyledLeyendaNombre>
              <StyledPunto color={sector.color} />
              {sector.etiqueta}
            </StyledLeyendaNombre>
            <StyledLeyendaValor>
              {formatearEntero(sector.valor)}
              {' · '}
              {formatearPorcentaje(sector.valor, total)}
            </StyledLeyendaValor>
          </StyledLeyendaFila>
        ))}
      </StyledLeyenda>
    </StyledContenedor>
  );
};
