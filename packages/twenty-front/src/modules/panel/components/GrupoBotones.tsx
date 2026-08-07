import { styled } from '@linaria/react';

// Filtros y ordenaciones que viven DENTRO del grafico.
//
// Antes cada corte de los datos era un widget aparte: "Compras: 24 meses",
// "Compras y ventas por mes", "Acumulado del ejercicio"... tres graficos para
// tres formas de mirar lo mismo, y el panel crecia hasta que ya nadie lo leia.
// Con los controles dentro, un grafico responde a las tres preguntas y quien
// mira elige, en vez de buscar cual de los tres era el suyo.
//
// Botones y no un desplegable: en un movil un desplegable son dos toques y una
// capa encima; estos se ven de una vez y se aciertan con el dedo.

export type OpcionBoton<T extends string> = {
  valor: T;
  etiqueta: string;
  /** Etiqueta corta para pantallas estrechas; si falta, se usa la larga. */
  etiquetaCorta?: string;
};

type GrupoBotonesProps<T extends string> = {
  opciones: OpcionBoton<T>[];
  seleccion: T;
  alCambiar: (valor: T) => void;
  etiquetaAccesible: string;
};

const StyledGrupo = styled.div`
  align-items: center;
  background: ${({ theme }) => theme.background.transparent.lighter};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  display: inline-flex;
  gap: 2px;
  padding: 2px;
`;

const StyledBoton = styled.button<{ activo: boolean }>`
  background: ${({ theme, activo }) =>
    activo ? theme.background.primary : 'transparent'};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: ${({ theme, activo }) => (activo ? theme.boxShadow.light : 'none')};
  color: ${({ theme, activo }) =>
    activo ? theme.font.color.primary : theme.font.color.tertiary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme, activo }) =>
    activo ? theme.font.weight.medium : theme.font.weight.regular};
  /* 32px de alto: lo minimo que un dedo acierta sin ampliar. */
  min-height: 32px;
  padding: 0 ${({ theme }) => theme.spacing(2)};
  white-space: nowrap;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledLarga = styled.span`
  @media (max-width: 640px) {
    display: none;
  }
`;

const StyledCorta = styled.span`
  display: none;

  @media (max-width: 640px) {
    display: inline;
  }
`;

export const GrupoBotones = <T extends string>({
  opciones,
  seleccion,
  alCambiar,
  etiquetaAccesible,
}: GrupoBotonesProps<T>) => (
  <StyledGrupo role="group" aria-label={etiquetaAccesible}>
    {opciones.map((opcion) => (
      <StyledBoton
        key={opcion.valor}
        type="button"
        activo={opcion.valor === seleccion}
        aria-pressed={opcion.valor === seleccion}
        onClick={() => alCambiar(opcion.valor)}
      >
        {opcion.etiquetaCorta ? (
          <>
            <StyledLarga>{opcion.etiqueta}</StyledLarga>
            <StyledCorta>{opcion.etiquetaCorta}</StyledCorta>
          </>
        ) : (
          opcion.etiqueta
        )}
      </StyledBoton>
    ))}
  </StyledGrupo>
);
