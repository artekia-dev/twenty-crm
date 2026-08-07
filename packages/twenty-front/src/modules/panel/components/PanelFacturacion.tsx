import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { GrupoBotones } from '@/panel/components/GrupoBotones';
import { TarjetaGrafico } from '@/panel/components/TarjetaGrafico';
import { TarjetaKpi } from '@/panel/components/TarjetaKpi';
import { enlacesDePanel } from '@/panel/datos/enlacesAFacturas';
import {
  agruparPor,
  calcularAntiguedad,
  calcularIva,
  calcularResumen,
  calcularSerieMensual,
  importeDe,
  type OrdenRanking,
} from '@/panel/datos/resumenPanel';
import { normalizarNif, useEmpresas } from '@/panel/datos/useEmpresas';
import {
  ETIQUETAS_PERIODO,
  usePanelFacturas,
  type Periodo,
} from '@/panel/datos/usePanelFacturas';
import { GraficoAnillo } from '@/panel/graficos/GraficoAnillo';
import { GraficoMeses } from '@/panel/graficos/GraficoMeses';
import { GraficoRanking } from '@/panel/graficos/GraficoRanking';
import { formatearEntero, formatearEuros, plural } from '@/panel/tema/formato';
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

// El interruptor de IVA gobierna TODOS los importes del panel, asi que va
// suelto encima de las cifras y no dentro de una tarjeta: dentro pareceria que
// solo afecta a esa.
const StyledAvisoTruncado = styled.div`
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[3]};
`;

// Aviso, no error: lo que falta por validar es trabajo, no una averia. Se
// pincha y lleva a esas facturas, porque quien lo lee lo siguiente que quiere
// es verlas.
const StyledAvisoSinValidar = styled(Link)`
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-left: 3px solid ${themeCssVariables.font.color.tertiary};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.secondary};
  display: block;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[3]};
  text-decoration: none;

  &:hover {
    background: ${themeCssVariables.background.transparent.lighter};
  }
`;

const StyledBarraIva = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: -${themeCssVariables.spacing[2]};
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

const IVA = [
  { valor: 'sin' as const, etiqueta: 'Sin IVA', etiquetaCorta: 'Base' },
  { valor: 'con' as const, etiqueta: 'Con IVA', etiquetaCorta: 'Total' },
];

const SOCIEDADES_MOSTRADAS = [
  { valor: 'todas' as const, etiqueta: 'Todas', etiquetaCorta: 'Todas' },
  { valor: 'conMovimiento' as const, etiqueta: 'Con movimiento', etiquetaCorta: 'Con mov.' },
];

const ORDENES: { valor: OrdenRanking; etiqueta: string; etiquetaCorta: string }[] = [
  { valor: 'importe', etiqueta: 'Por importe', etiquetaCorta: '€' },
  { valor: 'documentos', etiqueta: 'Por nº de facturas', etiquetaCorta: 'Nº' },
  { valor: 'nombre', etiqueta: 'Por nombre', etiquetaCorta: 'A-Z' },
];

export type PanelFacturacionProps = {
  /** Sin esto, el panel del grupo entero. Con esto, el de una sociedad. */
  sociedadId?: string;
  titulo: string;
};

export const PanelFacturacion = ({ sociedadId, titulo }: PanelFacturacionProps) => {
  const [periodo, setPeriodo] = useState<Periodo>('12m');
  const [direccion, setDireccion] = useState<'ambas' | 'compras' | 'ventas'>('ambas');
  const [orden, setOrden] = useState<OrdenRanking>('importe');
  // Por defecto sin IVA: la base imponible es lo que se compara entre periodos
  // y lo que va al modelo trimestral.
  const [iva, setIva] = useState<'sin' | 'con'>('sin');

  const conIva = iva === 'con';
  const [verTodasLasSociedades, setVerTodasLasSociedades] = useState(true);

  const { facturas, sinValidar, cargando, error, desde, truncado, totalReal } = usePanelFacturas(
    periodo,
    sociedadId,
  );

  const enlaces = useMemo(
    () => enlacesDePanel({ desde, sociedadId }),
    [desde, sociedadId],
  );
  const empresas = useEmpresas();

  // Sin una sola venta en el periodo, ofrecer la serie enseña a ignorar el
  // grafico: se pinta una linea plana en cero que no significa nada.
  const hayVentas = useMemo(
    () => facturas.some((f) => f.direccion === 'VENTA'),
    [facturas],
  );

  const resumen = useMemo(() => calcularResumen(facturas, conIva), [facturas, conIva]);

  const serie = useMemo(
    () => calcularSerieMensual(facturas, desde, new Date(), conIva),
    [facturas, desde, conIva],
  );

  // Quien es cada proveedor, en este orden: la ficha de empresa del CRM si su
  // NIF esta dado de alta —es el dato mantenido—, el nombre que se leyo del
  // documento si no, y el CIF a secas como ultimo recurso. Un CIF dice poco,
  // pero una tarjeta vacia no dice nada y encima parece que el panel falla.
  const proveedores = useMemo(
    () =>
      agruparPor(
        facturas.filter((f) => f.direccion === 'COMPRA'),
        (f) => {
          const nif = normalizarNif(f.cifEmisor);
          const ficha = nif ? empresas.porNif.get(nif) : undefined;
          const nombre = ficha?.nombre ?? f.contraparte ?? nif;

          return nombre ? { id: nif || nombre, nombre } : null;
        },
        orden,
        conIva,
      ).slice(0, 8),
    [facturas, orden, conIva, empresas],
  );

  // El NIF de cada proveedor, para poder escribirlo bajo el nombre y para
  // filtrar por el al pulsar la fila.
  const nifDeProveedor = useMemo(() => {
    const porGrupo = new Map<string, string>();

    for (const f of facturas) {
      const nif = normalizarNif(f.cifEmisor);

      if (!nif) continue;

      const ficha = empresas.porNif.get(nif);
      const clave = nif || (ficha?.nombre ?? f.contraparte ?? '');

      if (clave) porGrupo.set(clave, nif);
    }

    return porGrupo;
  }, [facturas, empresas]);

  const iva12 = useMemo(() => calcularIva(facturas), [facturas]);

  const antiguedad = useMemo(
    () => calcularAntiguedad(facturas, new Date(), conIva),
    [facturas, conIva],
  );

  // TODAS las sociedades del grupo, tengan o no movimiento en el periodo.
  //
  // Agrupar solo por las facturas dejaba fuera a las que no han registrado
  // nada, y eso es justo lo que se quiere ver desde la holding: una sociedad
  // sin una sola factura este trimestre no es un hueco en el grafico, es un
  // dato. Las de cero van al final, que es donde estorban menos.
  const porSociedad = useMemo(() => {
    const conMovimiento = agruparPor(
      facturas,
      (f) =>
        f.sociedadId
          ? {
              id: f.sociedadId,
              nombre: empresas.porId.get(f.sociedadId)?.nombre ?? 'Sin nombre',
            }
          : null,
      'importe',
      conIva,
    );

    const vistas = new Set(conMovimiento.map((s) => s.id));
    const paradas = empresas.delGrupo
      .filter((e) => !vistas.has(e.id))
      .map((e) => ({ id: e.id, nombre: e.nombre, importe: 0, documentos: 0 }));

    return [...conMovimiento, ...paradas];
  }, [facturas, conIva, empresas]);

  const sociedadesVisibles = useMemo(
    () => (verTodasLasSociedades ? porSociedad : porSociedad.filter((s) => s.documentos > 0)),
    [porSociedad, verTodasLasSociedades],
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
          <StyledTitulo>{titulo}</StyledTitulo>
          <StyledSubtitulo>
            {ETIQUETAS_PERIODO[periodo]} ·{' '}
            {cargando
              ? 'cargando…'
              : plural(resumen.numeroFacturas, 'factura', 'facturas')}
          </StyledSubtitulo>
        </StyledTitulos>
        <GrupoBotones
          opciones={PERIODOS}
          seleccion={periodo}
          alCambiar={setPeriodo}
          etiquetaAccesible="Periodo del panel"
        />
      </StyledCabecera>

      {truncado && (
        <StyledAvisoTruncado>
          Se han traído {formatearEntero(facturas.length + sinValidar.length)} facturas
          de {formatearEntero(totalReal)}. Las cifras de esta pantalla no están
          completas: acota el periodo para verlas todas.
        </StyledAvisoTruncado>
      )}

      {/* Sin esto, un panel a cero se lee como una avería en vez de como trabajo
          pendiente, que es lo que es. Y lleva a la lista de lo que falta. */}
      {sinValidar.length > 0 && (
        <StyledAvisoSinValidar to={enlaces.sinValidar()}>
          <strong>
            {sinValidar.length === 1
              ? '1 factura sin validar'
              : `${formatearEntero(sinValidar.length)} facturas sin validar`}
          </strong>{' '}
          por{' '}
          {formatearEuros(
            sinValidar.reduce((suma, f) => suma + importeDe(f, iva === 'con'), 0),
          )}
          . No entran en
          ninguna cifra de esta pantalla hasta que alguien las compruebe.
        </StyledAvisoSinValidar>
      )}

      <StyledBarraIva>
        <GrupoBotones
          opciones={IVA}
          seleccion={iva}
          alCambiar={setIva}
          etiquetaAccesible="Importes con o sin IVA"
        />
      </StyledBarraIva>

      <StyledCifras>
        <TarjetaKpi
          titulo="Compras"
          valor={formatearEuros(resumen.compras)}
          detalle={`${conIva ? 'Total con IVA' : 'Base imponible'} del periodo`}
          color="compras"
          enlace={enlaces.porDireccion('COMPRA')}
        />
        <TarjetaKpi
          titulo="Ventas"
          valor={formatearEuros(resumen.ventas)}
          detalle={`${conIva ? 'Total con IVA' : 'Base imponible'} del periodo`}
          color="ventas"
          enlace={enlaces.porDireccion('VENTA')}
        />
        <TarjetaKpi
          titulo="Sin contabilizar"
          valor={formatearEuros(resumen.importePendiente)}
          detalle={plural(resumen.pendientesDeContabilizar, 'factura', 'facturas')}
          color="pendiente"
          enlace={enlaces.sinContabilizar()}
        />
        <TarjetaKpi
          titulo="Pendiente de pago"
          valor={formatearEuros(resumen.importePendienteDePago)}
          detalle={`${plural(resumen.pendientesDePago, 'compra', 'compras')} sin pagar`}
          enlace={enlaces.sinPagar()}
        />
      </StyledCifras>

      <StyledGraficos>
        <TarjetaGrafico
          titulo="Compras y ventas por mes"
          descripcion={`${conIva ? 'Total con IVA' : 'Base imponible'}. Toca un mes para ver el detalle.`}
          controles={
            <GrupoBotones
              opciones={hayVentas ? DIRECCIONES : [DIRECCIONES[0]!, DIRECCIONES[1]!]}
              seleccion={direccion}
              alCambiar={setDireccion}
              etiquetaAccesible="Qué series se muestran"
            />
          }
        >
          <GraficoMeses
            datos={serie}
            mostrarCompras={direccion !== 'ventas'}
            mostrarVentas={hayVentas && direccion !== 'compras'}
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
              filas={proveedores.map((p, i) => {
                const nif = nifDeProveedor.get(p.id);
                const documentos = plural(p.documentos, 'factura', 'facturas');

                return {
                  id: p.id,
                  nombre: p.nombre,
                  // El NIF debajo del nombre, no en su lugar: identifica sin
                  // ruido cuando dos proveedores se llaman parecido.
                  detalle: nif && nif !== p.nombre ? `${nif} · ${documentos}` : documentos,
                  valor: p.importe,
                  color: colorDeCategoria(i),
                  enlace: enlaces.deProveedor({ cif: nif, nombre: p.nombre }),
                };
              })}
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

        <StyledDosColumnas>
          <TarjetaGrafico
            titulo="IVA del periodo"
            descripcion="Lo que se lleva al modelo trimestral"
          >
            <StyledCifras>
              <TarjetaKpi
                titulo="Soportado"
                valor={formatearEuros(iva12.soportado)}
                detalle="IVA de las compras · se deduce"
                color="compras"
                enlace={enlaces.porDireccion('COMPRA')}
              />
              <TarjetaKpi
                titulo="Repercutido"
                valor={formatearEuros(iva12.repercutido)}
                detalle="IVA de las ventas · se ingresa"
                color="ventas"
                enlace={enlaces.porDireccion('VENTA')}
              />
              <TarjetaKpi
                titulo={iva12.diferencia >= 0 ? 'A ingresar' : 'A compensar'}
                valor={formatearEuros(Math.abs(iva12.diferencia))}
                detalle="Repercutido menos soportado"
              />
            </StyledCifras>
          </TarjetaGrafico>

          <TarjetaGrafico
            titulo="Antigüedad de lo pendiente"
            descripcion="Cuánto llevan esperando las facturas sin contabilizar"
          >
            <GraficoRanking
              filas={antiguedad.map((tramo) => ({
                id: tramo.id,
                nombre: tramo.etiqueta,
                detalle: plural(tramo.documentos, 'factura', 'facturas'),
                valor: tramo.importe,
                // El rojo se reserva a lo que lleva mas de tres meses parado:
                // eso ya no es el ritmo normal de trabajo.
                color:
                  tramo.id === 'viejo' || tramo.id === 'sinFecha'
                    ? COLORES.aviso
                    : tramo.id === 'medio'
                      ? COLORES.pendiente
                      : COLORES.neutro,
                enlace: enlaces.sinContabilizar(),
              }))}
            />
          </TarjetaGrafico>
        </StyledDosColumnas>

        {!sociedadId && porSociedad.length > 1 && (
          <TarjetaGrafico
            titulo="Reparto por sociedad"
            descripcion="Qué parte del movimiento del grupo lleva cada una"
            controles={
              <GrupoBotones
                opciones={SOCIEDADES_MOSTRADAS}
                seleccion={verTodasLasSociedades ? 'todas' : 'conMovimiento'}
                alCambiar={(v) => setVerTodasLasSociedades(v === 'todas')}
                etiquetaAccesible="Qué sociedades se muestran"
              />
            }
          >
            <GraficoRanking
              filas={sociedadesVisibles.map((soc, i) => ({
                id: soc.id,
                nombre: soc.nombre,
                detalle:
                  soc.documentos === 0
                    ? 'Sin movimiento en el periodo'
                    : plural(soc.documentos, 'factura', 'facturas'),
                valor: soc.importe,
                color: soc.documentos === 0 ? COLORES.neutro : colorDeCategoria(i),
                enlace: enlaces.deSociedad(soc.id),
              }))}
              total={porSociedad.reduce((suma, s) => suma + s.importe, 0)}
            />
          </TarjetaGrafico>
        )}

        {(resumen.conAvisoSociedad > 0 ||
          resumen.conAvisoTipo > 0 ||
          resumen.sinSociedad > 0 ||
          resumen.sinDireccion > 0) && (
          <TarjetaGrafico
            titulo="Necesita una mirada"
            descripcion="Lo que el sistema no ha podido resolver solo"
          >
            <StyledCifras>
              <TarjetaKpi
                titulo="Aviso de sociedad"
                valor={formatearEntero(resumen.conAvisoSociedad)}
                detalle="El CIF no casa con la ficha, o la carpeta dice otra"
                esAviso={resumen.conAvisoSociedad > 0}
                enlace={enlaces.conAvisoSociedad()}
              />
              <TarjetaKpi
                titulo="Aviso de documento"
                valor={formatearEntero(resumen.conAvisoTipo)}
                detalle="Ilegible, tipo inesperado o varios en un PDF"
                esAviso={resumen.conAvisoTipo > 0}
                enlace={enlaces.conAvisoTipo()}
              />
              {/* En el panel de una sociedad siempre valdria 0: se filtra por
                  sociedad, asi que una factura sin ella nunca entra. */}
              {!sociedadId && (
                <TarjetaKpi
                  titulo="Sin sociedad"
                  valor={formatearEntero(resumen.sinSociedad)}
                  detalle="Esperando en la carpeta general"
                  esAviso={resumen.sinSociedad > 0}
                  enlace={enlaces.sinSociedad()}
                />
              )}
              <TarjetaKpi
                titulo="Sin compra ni venta"
                valor={formatearEntero(resumen.sinDireccion)}
                detalle="No se supo de qué lado está el grupo"
                esAviso={resumen.sinDireccion > 0}
                enlace={enlaces.sinDireccion()}
              />
            </StyledCifras>
          </TarjetaGrafico>
        )}
      </StyledGraficos>
    </StyledPagina>
  );
};
