import { css } from '@linaria/core';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { createPortal } from 'react-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

// Lo que va a cambiar al releer un documento, antes de que cambie.
//
// La lista que se pinta aqui es LA MISMA que se guarda al confirmar: el
// servidor la calculo una vez y confirmar solo la aplica. Si al confirmar se
// volviera a leer, saldrian otros numeros —el modelo no da siempre lo mismo— y
// se guardarian cambios que nadie vio. Una pantalla de confirmacion que miente
// es peor que no tenerla, porque se deja de leer.

export type CambioPropuesto = {
  campo: string;
  etiqueta: string;
  antes: unknown;
  despues: unknown;
};

type CambiosDeRelecturaProps = {
  cambios: CambioPropuesto[];
  aplicando: boolean;
  error?: string;
  alConfirmar: () => void;
  alCancelar: () => void;
};

const StyledFondo = styled.div`
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: ${themeCssVariables.spacing[4]};
  position: fixed;
  z-index: 1000;
`;

const StyledCaja = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  /* Nunca mas alto que la pantalla: con veinte campos cambiados la lista
     crece sin fin y los botones quedan fuera, sin forma de confirmar. */
  max-height: 80vh;
  max-width: 560px;
  /* Que la cabecera y el pie no se encojan para dejarle sitio a la lista. */
  min-height: 0;
  width: 100%;
`;

const StyledCabecera = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledTitulo = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledSubtitulo = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[1]} 0 0;
`;

const StyledLista = styled.div`
  display: flex;
  flex-direction: column;
  /* min-height 0 es lo que permite que un hijo de un flex encoja por debajo de
     su contenido. Sin el, la lista crece hasta ocupar lo que necesite, el
     max-height de la caja no llega a aplicarse y no hay scroll. */
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]} 0;
`;

const StyledFila = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};

  & + & {
    border-top: 1px solid ${themeCssVariables.border.color.light};
  }
`;

const StyledCampo = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  text-transform: uppercase;
`;

const StyledValores = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
`;

// El valor viejo tachado: se ve de un vistazo que desaparece, sin leer nada.
const StyledAntes = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  text-decoration: line-through;
`;

const StyledDespues = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledPie = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  /* Los botones se quedan siempre visibles: son la unica salida del dialogo. */
  flex-shrink: 0;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
  padding: ${themeCssVariables.spacing[4]};
`;

const StyledError = styled.p`
  color: ${themeCssVariables.font.color.danger};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0 ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[2]};
`;

const boton = css`
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 32px;
  padding: 0 ${themeCssVariables.spacing[3]};

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;

const botonSecundario = css`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  color: ${themeCssVariables.font.color.primary};
`;

const botonPrincipal = css`
  background: ${themeCssVariables.font.color.primary};
  border: 1px solid ${themeCssVariables.font.color.primary};
  color: ${themeCssVariables.background.primary};
`;

/**
 * Un valor del CRM en algo que se pueda leer.
 *
 * Los importes viajan en micros y las fechas con hora: enseñarlos en crudo
 * obligaria a interpretar "241260000" para saber si el cambio esta bien, que es
 * justo lo que esta pantalla existe para evitar.
 */
const comoTexto = (valor: unknown): string => {
  if (valor === null || valor === undefined || valor === '') return '—';

  if (Array.isArray(valor)) return valor.length > 0 ? valor.join(', ') : '—';

  if (typeof valor === 'object') {
    const o = valor as Record<string, unknown>;

    if (typeof o.amountMicros === 'number') {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        useGrouping: 'always',
      }).format(o.amountMicros / 1_000_000);
    }

    if (typeof o.primaryLinkUrl === 'string') return o.primaryLinkUrl;

    return JSON.stringify(valor);
  }

  const texto = String(valor);
  const fecha = texto.match(/^(\d{4})-(\d{2})-(\d{2})T/);

  return fecha ? `${fecha[3]}/${fecha[2]}/${fecha[1]}` : texto;
};

export const CambiosDeRelectura = ({
  cambios,
  aplicando,
  error,
  alConfirmar,
  alCancelar,
}: CambiosDeRelecturaProps) =>
  // Se monta en el body y no donde vive el componente: `position: fixed` se
  // ancla al ancestro mas cercano con `transform` o `filter`, no al viewport,
  // y el dialogo salia encajado dentro del visor del documento.
  createPortal(
  <StyledFondo role="dialog" aria-modal="true" onClick={alCancelar}>
    <StyledCaja onClick={(evento) => evento.stopPropagation()}>
      <StyledCabecera>
        <StyledTitulo>{t`Cambios de la nueva lectura`}</StyledTitulo>
        <StyledSubtitulo>
          {cambios.length === 1
            ? t`Se va a cambiar 1 dato. Nada más.`
            : t`Se van a cambiar ${cambios.length} datos. Nada más.`}
        </StyledSubtitulo>
      </StyledCabecera>

      <StyledLista>
        {cambios.map((cambio) => (
          <StyledFila key={cambio.campo}>
            <StyledCampo>{cambio.etiqueta}</StyledCampo>
            <StyledValores>
              <StyledAntes>{comoTexto(cambio.antes)}</StyledAntes>
              <span aria-hidden>→</span>
              <StyledDespues>{comoTexto(cambio.despues)}</StyledDespues>
            </StyledValores>
          </StyledFila>
        ))}
      </StyledLista>

      {error && <StyledError>{error}</StyledError>}

      <StyledPie>
        <button
          type="button"
          className={`${boton} ${botonSecundario}`}
          onClick={alCancelar}
          disabled={aplicando}
        >
          {t`Dejarlo como está`}
        </button>
        <button
          type="button"
          className={`${boton} ${botonPrincipal}`}
          onClick={alConfirmar}
          disabled={aplicando}
        >
          {aplicando ? t`Guardando…` : t`Aplicar estos cambios`}
        </button>
      </StyledPie>
    </StyledCaja>
  </StyledFondo>,
    document.body,
  );
