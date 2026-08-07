import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

// Marco de un grafico: titulo, sus controles y el grafico debajo.
//
// Los controles van en la cabecera de la propia tarjeta, no en una barra
// global del panel. Un filtro global obliga a mirar arriba para saber que
// estas viendo abajo, y cuando hay ocho graficos en pantalla eso se pierde.
// Aqui cada grafico dice de que periodo habla, a su lado.

type TarjetaGraficoProps = {
  titulo: string;
  /** Que responde este grafico. Va bajo el titulo, no en un icono de ayuda. */
  descripcion?: string;
  controles?: ReactNode;
  children: ReactNode;
};

const StyledTarjeta = styled.section`
  background: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledCabecera = styled.header`
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: space-between;
`;

const StyledTextos = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  /* Deja que los controles bajen a su propia linea antes que aplastar el
     titulo: en un movil el titulo es lo que orienta. */
  min-width: 180px;
`;

const StyledTitulo = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin: 0;
`;

const StyledDescripcion = styled.p`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  margin: 0;
`;

const StyledControles = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
`;

export const TarjetaGrafico = ({
  titulo,
  descripcion,
  controles,
  children,
}: TarjetaGraficoProps) => (
  <StyledTarjeta>
    <StyledCabecera>
      <StyledTextos>
        <StyledTitulo>{titulo}</StyledTitulo>
        {descripcion && <StyledDescripcion>{descripcion}</StyledDescripcion>}
      </StyledTextos>
      {controles && <StyledControles>{controles}</StyledControles>}
    </StyledCabecera>
    {children}
  </StyledTarjeta>
);
