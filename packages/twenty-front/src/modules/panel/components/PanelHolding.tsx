import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useMemo, useState } from 'react';

import { GrupoBotones } from '@/panel/components/GrupoBotones';
import { TarjetaGrafico } from '@/panel/components/TarjetaGrafico';
import { TarjetaKpi } from '@/panel/components/TarjetaKpi';
import {
  agruparPor,
  calcularResumen,
  calcularSerieMensual,
  type OrdenRanking,
} from '@/panel/datos/resumenPanel';
import {
  ETIQUETAS_PERIODO,
  usePanelFacturas,
  type Periodo,
} from '@/panel/datos/usePanelFacturas';
import { GraficoAnillo } from '@/panel/graficos/GraficoAnillo';
import { GraficoMeses } from '@/panel/graficos/GraficoMeses';
import { GraficoRanking } from '@/panel/graficos/GraficoRanking';
import { formatearEntero, formatearEuros } from '@/panel/tema/formato';
import { COLORES, colorDeCategoria } from '@/panel/tema/paleta';

// Panel de la holding.
//
// El panel anterior tenia setenta y ocho widgets repartidos en cinco pestanas.
// Cada corte de los datos era un widget mas, asi que mirar "como va el mes"
// obligaba a recorrer la pagina buscando cual de los treinta numeros era ese.
// Aqui hay cuatro cifras arriba y tres graficos que se filtran y se ordenan
// solos, en una columna que cabe en un movil.

const StyledPagina = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  margin: 0 auto;
  max-width: 1180px;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[4]};
  width: 100%;

  @media (max-width: 640px) {
    gap: ${themeCssVariables.spacing[4]};
    padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[3]};
  }
`;

const StyledCabecera = styled.header`
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: space-between;
`;

const StyledTitulos = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StyledTitulo = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: 22px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledSubtitulo = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

// Las cifras se reparten solas segun el ancho: cuatro en escritorio, dos en
// tableta y una en movil, sin un breakpoint por cada caso.
const StyledCifras = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[3]};
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const StyledGraficos = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

const StyledDosColumnas = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[4]};
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
`;

const StyledAviso = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
`;

const PERIODOS: { valor: Periodo; etiqueta: string; etiquetaCorta: string }[] = [
  { valor: '3m', etiqueta: '3 meses', etiquetaCorta: '3M' },
  { valor: '12m', etiqueta: '12 meses', etiquetaCorta: '12M' },
  { valor: '24m', etiqueta: '24 meses', etiquetaCorta: '24M' },
  { valor: 'ejercicio', etiqueta: 'Ejercicio', etiquetaCorta: 'Año' },
];

const DIRECCIONES = [
  { valor: 'ambas' as const, etiqueta: 'Compras y ventas', etiquetaCorta: 'Ambas' },
  { valor: 'compras' as const, etiqueta: 'Compras' },
  { valor: 'ventas' as const, etiqueta: 'Ventas' },
];

const ORDENES: { valor: OrdenRanking; etiqueta: string; etiquetaCorta: string }[] = [
  { valor: 'importe', etiqueta: 'Por importe', etiquetaCorta: '€' },
  { valor: 'documentos', etiqueta: 'Por nº de facturas', etiquetaCorta: 'Nº' },
  { valor: 'nombre', etiqueta: 'Por nombre', etiquetaCorta: 'A-Z' },
];

export const PanelHolding = () => {
  const [periodo, setPeriodo] = useState<Periodo>('12m');
  const [direccion, setDireccion] = useState<'ambas' | 'compras' | 'ventas'>('ambas');
  const [orden, setOrden] = useState<OrdenRanking>('importe');

  const { facturas, cargando, error, desde } = usePanelFacturas(periodo);

  const resumen = useMemo(() => calcularResumen(facturas), [facturas]);

  const serie = useMemo(
    () => calcularSerieMensual(facturas, desde, new Date()),
    [facturas, desde],
  );

  const proveedores = useMemo(
    () =>
      agruparPor(
        facturas.filter((f) => f.direccion === 'COMPRA'),
        (f) => (f.contraparte ? { id: f.contraparte, nombre: f.contraparte } : null),
        orden,
      ).slice(0, 8),
    [facturas, orden],
  );

  const totalProveedores = proveedores.reduce((suma, p) => suma + p.importe, 0);

  const circuito = useMemo(
    () => [
      {
        id: 'contabilizadas',
        etiqueta: 'Contabilizadas',
        valor: facturas.filter((f) => f.contabilizada === true).length,
        color: COLORES.hecho,
      },
      {
        id: 'pendientes',
        etiqueta: 'Sin contabilizar',
        valor: facturas.filter((f) => f.contabilizada !== true).length,
        color: COLORES.pendiente,
      },
    ],
    [facturas],
  );

  if (error) {
    return (
      <StyledPagina>
        <StyledAviso>
          No se han podido cargar las facturas. Vuelve a intentarlo en un momento.
        </StyledAviso>
      </StyledPagina>
    );
  }

  return (
    <StyledPagina>
      <StyledCabecera>
        <StyledTitulos>
          <StyledTitulo>Holding · CFARYC</StyledTitulo>
          <StyledSubtitulo>
            {ETIQUETAS_PERIODO[periodo]} ·{' '}
            {cargando
              ? 'cargando…'
              : `${formatearEntero(resumen.numeroFacturas)} facturas`}
          </StyledSubtitulo>
        </StyledTitulos>
        <GrupoBotones
          opciones={PERIODOS}
          seleccion={periodo}
          alCambiar={setPeriodo}
          etiquetaAccesible="Periodo del panel"
        />
      </StyledCabecera>

      <StyledCifras>
        <TarjetaKpi
          titulo="Compras"
          valor={formatearEuros(resumen.compras)}
          detalle="Base imponible del periodo"
          color="compras"
        />
        <TarjetaKpi
          titulo="Ventas"
          valor={formatearEuros(resumen.ventas)}
          detalle="Base imponible del periodo"
          color="ventas"
        />
        <TarjetaKpi
          titulo="Sin contabilizar"
          valor={formatearEuros(resumen.importePendiente)}
          detalle={`${formatearEntero(resumen.pendientesDeContabilizar)} facturas · IVA incluido`}
          color="pendiente"
        />
        <TarjetaKpi
          titulo="Pendiente de pago"
          valor={formatearEuros(resumen.importePendienteDePago)}
          detalle={`${formatearEntero(resumen.pendientesDePago)} compras · IVA incluido`}
        />
      </StyledCifras>

      <StyledGraficos>
        <TarjetaGrafico
          titulo="Compras y ventas por mes"
          descripcion="Base imponible. Toca un mes para ver el detalle."
          controles={
            <GrupoBotones
              opciones={DIRECCIONES}
              seleccion={direccion}
              alCambiar={setDireccion}
              etiquetaAccesible="Qué series se muestran"
            />
          }
        >
          <GraficoMeses
            datos={serie}
            mostrarCompras={direccion !== 'ventas'}
            mostrarVentas={direccion !== 'compras'}
          />
        </TarjetaGrafico>

        <StyledDosColumnas>
          <TarjetaGrafico
            titulo="Principales proveedores"
            descripcion="Compras del periodo"
            controles={
              <GrupoBotones
                opciones={ORDENES}
                seleccion={orden}
                alCambiar={setOrden}
                etiquetaAccesible="Orden del ranking"
              />
            }
          >
            <GraficoRanking
              filas={proveedores.map((p, i) => ({
                id: p.id,
                nombre: p.nombre,
                valor: p.importe,
                color: colorDeCategoria(i),
              }))}
              total={totalProveedores}
            />
          </TarjetaGrafico>

          <TarjetaGrafico
            titulo="Estado del circuito"
            descripcion="Facturas del periodo"
          >
            <GraficoAnillo sectores={circuito} leyendaCentro="facturas en el periodo" />
          </TarjetaGrafico>
        </StyledDosColumnas>

        {(resumen.conAviso > 0 ||
          resumen.sinSociedad > 0 ||
          resumen.sinDireccion > 0) && (
          <TarjetaGrafico
            titulo="Necesita una mirada"
            descripcion="Lo que el sistema no ha podido resolver solo"
          >
            <StyledCifras>
              <TarjetaKpi
                titulo="Con aviso"
                valor={formatearEntero(resumen.conAviso)}
                detalle="Datos maestros o lectura a confirmar"
                esAviso={resumen.conAviso > 0}
              />
              <TarjetaKpi
                titulo="Sin sociedad"
                valor={formatearEntero(resumen.sinSociedad)}
                detalle="Esperando en la carpeta general"
                esAviso={resumen.sinSociedad > 0}
              />
              <TarjetaKpi
                titulo="Sin compra ni venta"
                valor={formatearEntero(resumen.sinDireccion)}
                detalle="No se supo de qué lado está el grupo"
                esAviso={resumen.sinDireccion > 0}
              />
            </StyledCifras>
          </TarjetaGrafico>
        )}
      </StyledGraficos>
    </StyledPagina>
  );
};
