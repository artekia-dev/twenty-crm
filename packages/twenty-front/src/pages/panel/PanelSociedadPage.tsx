import { styled } from '@linaria/react';
import { useParams } from 'react-router-dom';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { PanelFacturacion } from '@/panel/components/PanelFacturacion';
import { useEmpresas } from '@/panel/datos/useEmpresas';
import { PageCardLayout } from '@/ui/layout/page/components/PageCardLayout';

// El panel de UNA sociedad. Es el mismo componente que el del grupo, con el
// filtro puesto: si fueran dos componentes distintos, cualquier arreglo habria
// que hacerlo dos veces y acabarian divergiendo.

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

const StyledAviso = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
`;

export const PanelSociedadPage = () => {
  const { sociedadId } = useParams<{ sociedadId: string }>();
  const empresas = useEmpresas();

  if (!sociedadId) return null;

  const ficha = empresas.porId.get(sociedadId);

  return (
    <PageCardLayout header={null}>
      <StyledDesplazable>
        {/* Mientras carga la lista de empresas no se sabe el nombre. Se pinta
            el panel igual —los datos ya vienen filtrados por id— y solo el
            titulo espera: bloquear la pagina entera por un rotulo seria peor. */}
        {empresas.porId.size > 0 && !ficha ? (
          <StyledAviso>Esta sociedad no existe o no tienes acceso a ella.</StyledAviso>
        ) : (
          <PanelFacturacion sociedadId={sociedadId} titulo={ficha?.nombre ?? 'Sociedad'} />
        )}
      </StyledDesplazable>
    </PageCardLayout>
  );
};
