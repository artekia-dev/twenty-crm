import { styled } from '@linaria/react';

import { COLORES, type NombreColor } from '@/panel/tema/paleta';

// Una cifra grande con su titulo y, si aporta algo, una linea de contexto.
//
// El panel viejo tenia treinta y tantas cifras sueltas por pestana, todas del
// mismo tamano: nada destacaba y habia que leerlas una a una para saber cual
// importaba. Aqui la cifra manda y todo lo demas es secundario, que es como se
// mira un panel: primero el numero, y solo si sorprende, el resto.

type TarjetaKpiProps = {
  titulo: string;
  valor: string;
  /** Segunda linea: el desglose, la comparacion o cuantos documentos son. */
  detalle?: string;
  color?: NombreColor;
  /** Pinta la cifra en rojo cuando el valor esperado era cero. */
  esAviso?: boolean;
  alPulsar?: () => void;
};

const StyledTarjeta = styled.button<{ pulsable: boolean }>`
  align-items: flex-start;
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  cursor: ${({ pulsable }) => (pulsable ? 'pointer' : 'default')};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  /* Alto igual en toda la fila aunque unas tengan detalle y otras no. */
  min-height: 96px;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(3)};
  text-align: left;
  transition: border-color 150ms;
  width: 100%;

  &:hover {
    border-color: ${({ theme, pulsable }) =>
      pulsable ? theme.border.color.strong : theme.border.color.light};
  }
`;

const StyledTitulo = styled.span`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const StyledValor = styled.span<{ colorTexto: string }>`
  color: ${({ colorTexto }) => colorTexto};
  font-size: 26px;
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  line-height: 1.15;
  /* Los importes se comparan en vertical entre tarjetas: con cifras de ancho
     fijo las unidades quedan alineadas y se ve cual es mayor sin leerlas. */
  font-variant-numeric: tabular-nums;
`;

const StyledDetalle = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
`;

export const TarjetaKpi = ({
  titulo,
  valor,
  detalle,
  color,
  esAviso,
  alPulsar,
}: TarjetaKpiProps) => {
  const colorTexto = esAviso
    ? COLORES.aviso
    : color
      ? COLORES[color]
      : 'currentColor';

  return (
    <StyledTarjeta
      type="button"
      pulsable={Boolean(alPulsar)}
      onClick={alPulsar}
      disabled={!alPulsar}
    >
      <StyledTitulo>{titulo}</StyledTitulo>
      <StyledValor colorTexto={colorTexto}>{valor}</StyledValor>
      {detalle && <StyledDetalle>{detalle}</StyledDetalle>}
    </StyledTarjeta>
  );
};
