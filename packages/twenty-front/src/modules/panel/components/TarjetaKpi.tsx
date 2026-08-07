import { css } from '@linaria/core';
import { styled } from '@linaria/react';
import { Link } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

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
  /** A donde lleva: la lista de facturas ya filtrada por lo que cuenta la cifra. */
  enlace?: string;
};

// Los estilos van en una clase suelta y no en dos componentes con el mismo
// cuerpo: la tarjeta es un <a> cuando lleva a algun sitio y un <div> cuando no,
// y duplicar el bloque acabaria con los dos separandose a la primera.
const tarjeta = css`
  align-items: flex-start;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  /* Alto igual en toda la fila aunque unas tengan detalle y otras no. */
  min-height: 96px;
  justify-content: center;
  padding: ${themeCssVariables.spacing[3]};
  text-align: left;
  width: 100%;
`;

// Solo cuando lleva a algun sitio. Si no, el puntero prometeria algo que no
// ocurre al pulsar.
const tarjetaPulsable = css`
  cursor: pointer;
  text-decoration: none;
  transition: border-color 150ms;

  &:hover {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledTitulo = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  letter-spacing: 0.02em;
  text-transform: uppercase;
`;

const StyledValor = styled.span<{ colorTexto: string }>`
  color: ${({ colorTexto }) => colorTexto};
  font-size: 26px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.15;
  /* Los importes se comparan en vertical entre tarjetas: con cifras de ancho
     fijo las unidades quedan alineadas y se ve cual es mayor sin leerlas. */
  font-variant-numeric: tabular-nums;
`;

const StyledDetalle = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
`;

export const TarjetaKpi = ({
  titulo,
  valor,
  detalle,
  color,
  esAviso,
  enlace,
}: TarjetaKpiProps) => {
  const colorTexto = esAviso ? COLORES.aviso : color ? COLORES[color] : 'currentColor';

  const contenido = (
    <>
      <StyledTitulo>{titulo}</StyledTitulo>
      <StyledValor colorTexto={colorTexto}>{valor}</StyledValor>
      {detalle && <StyledDetalle>{detalle}</StyledDetalle>}
    </>
  );

  // Un enlace de verdad y no un div con onClick: asi se puede abrir en otra
  // pestana, copiar la direccion y llegar con el teclado.
  if (enlace) {
    return (
      <Link to={enlace} className={`${tarjeta} ${tarjetaPulsable}`}>
        {contenido}
      </Link>
    );
  }

  return <div className={tarjeta}>{contenido}</div>;
};
