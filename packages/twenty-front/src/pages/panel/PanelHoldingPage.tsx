import { styled } from '@linaria/react';

import { PanelFacturacion } from '@/panel/components/PanelFacturacion';
import { PageCardLayout } from '@/ui/layout/page/components/PageCardLayout';

// El scroll lo tiene que declarar la pagina, no el navegador.
//
// El marco del CRM reparte la altura con flex y no deja que el contenido
// desborde la ventana: sin un contenedor propio que scrollee, todo lo que pasa
// del alto visible simplemente se corta y no hay forma de llegar a ello.
// `min-height: 0` es lo que permite que un hijo de un flex encoja por debajo de
// su contenido; sin eso, `overflow-y: auto` no llega a activarse nunca.
const StyledDesplazable = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;

  @media print {
    display: block;
    min-height: auto;
    overflow: visible;
  }
`;

/** El grupo entero: suma de todas las sociedades que el usuario pueda ver. */
export const PanelHoldingPage = () => (
  <PageCardLayout header={null}>
    <StyledDesplazable>
      <PanelFacturacion titulo="Todo el grupo · CFARYC" />
    </StyledDesplazable>
  </PageCardLayout>
);
