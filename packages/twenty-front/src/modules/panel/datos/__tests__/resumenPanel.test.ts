import {
  agruparPor,
  calcularAntiguedad,
  calcularIva,
  calcularResumen,
  calcularSerieMensual,
} from '@/panel/datos/resumenPanel';
import { type FacturaPanel } from '@/panel/datos/usePanelFacturas';
import { escalaBonita } from '@/panel/tema/formato';

// Un total mal sumado en un panel no se nota: el numero sale, parece razonable
// y nadie lo comprueba contra la contabilidad hasta el cierre. Por eso los
// calculos estan fuera de los componentes y probados.

const factura = (over: Partial<FacturaPanel> = {}): FacturaPanel => ({
  id: Math.random().toString(36).slice(2),
  fechaEmision: '2026-03-15T00:00:00.000Z',
  direccion: 'COMPRA',
  contabilizada: true,
  pagada: true,
  conciliada: false,
  estadoExtraccion: 'OK',
  avisoSociedad: null,
  avisoTipo: null,
  contraparte: 'Proveedor SL',
  cifEmisor: 'B12345678',
  sociedadId: 'soc-1',
  base: { amountMicros: 100_000_000 },
  iva: { amountMicros: 21_000_000 },
  total: { amountMicros: 121_000_000 },
  ...over,
});

describe('calcularResumen', () => {
  it('separa compras de ventas por la base imponible', () => {
    const r = calcularResumen([
      factura({ direccion: 'COMPRA' }),
      factura({ direccion: 'VENTA', base: { amountMicros: 250_000_000 } }),
    ], false);

    expect(r.compras).toBe(100);
    expect(r.ventas).toBe(250);
    expect(r.numeroFacturas).toBe(2);
  });

  // Sin base no se puede comparar con nada, pero el total sigue siendo un dato
  // real del documento: mejor contarlo que dejar la cifra a cero.
  it('usa el total cuando no hay base', () => {
    const r = calcularResumen([
      factura({ base: { amountMicros: 0 }, total: { amountMicros: 121_000_000 } }),
    ], false);

    expect(r.compras).toBe(121);
  });

  it('cuenta lo que queda por contabilizar, con su importe', () => {
    const r = calcularResumen([
      factura({ contabilizada: false }),
      factura({ contabilizada: null }),
      factura({ contabilizada: true }),
    ], false);

    expect(r.pendientesDeContabilizar).toBe(2);
    // Sin IVA: la base de las dos. El importe sigue la magnitud elegida en el
    // panel, no una fija, o la cifra no cuadraria con las de al lado.
    expect(r.importePendiente).toBe(200);
  });

  // "Cuanto debemos" son las compras sin pagar. Una venta sin cobrar es otra
  // pregunta y se responde en otro sitio.
  it('lo pendiente de pago son solo las compras', () => {
    const r = calcularResumen([
      factura({ direccion: 'COMPRA', pagada: false }),
      factura({ direccion: 'VENTA', pagada: false }),
    ], false);

    expect(r.pendientesDePago).toBe(1);
    expect(r.importePendienteDePago).toBe(100);
  });

  // Cada cifra lleva a una lista filtrada: si la cifra sumara los dos tipos de
  // aviso, al pulsarla apareceria otro numero de filas. Paso de verdad: 9 en el
  // panel, 7 en la lista.
  it('cuenta cada tipo de aviso por separado, como el filtro al que lleva', () => {
    const r = calcularResumen([
      factura({ avisoSociedad: 'CIF_NO_COINCIDE' }),
      factura({ avisoTipo: 'VARIOS_EN_ARCHIVO' }),
      factura({ sociedadId: null }),
      factura({ direccion: 'DESCONOCIDA' }),
      factura({ direccion: null }),
    ], false);

    expect(r.conAvisoSociedad).toBe(1);
    expect(r.conAvisoTipo).toBe(1);
    expect(r.sinSociedad).toBe(1);
    expect(r.sinDireccion).toBe(2);
  });

  // El interruptor del panel: la base es lo que se compara entre periodos y va
  // al modelo de IVA; el total es lo que sale de la cuenta.
  it('con IVA suma el total, sin IVA la base', () => {
    const unas = [factura({ direccion: 'COMPRA', pagada: false, contabilizada: false })];

    expect(calcularResumen(unas, false).compras).toBe(100);
    expect(calcularResumen(unas, true).compras).toBe(121);
    expect(calcularResumen(unas, true).importePendiente).toBe(121);
    expect(calcularResumen(unas, true).importePendienteDePago).toBe(121);
  });

  it('si falta el importe de la magnitud pedida, usa el otro', () => {
    // Media cifra es mejor que un cero, que ademas se lee como "no hay nada".
    const sinTotal = [factura({ total: { amountMicros: 0 } })];
    const sinBase = [factura({ base: { amountMicros: 0 } })];

    expect(calcularResumen(sinTotal, true).compras).toBe(121);
    expect(calcularResumen(sinBase, false).compras).toBe(121);
  });

  it('sin facturas devuelve ceros y no revienta', () => {
    const r = calcularResumen([], false);

    expect(r.compras).toBe(0);
    expect(r.numeroFacturas).toBe(0);
  });
});

describe('calcularSerieMensual', () => {
  it('incluye los meses vacios', () => {
    const serie = calcularSerieMensual(
      [factura({ fechaEmision: '2026-01-10T00:00:00.000Z' })],
      new Date(2026, 0, 1),
      new Date(2026, 2, 31),
      false,
    );

    expect(serie.map((p) => p.mes)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(serie[1]?.compras).toBe(0);
  });

  it('suma cada factura en su mes', () => {
    const serie = calcularSerieMensual(
      [
        factura({ fechaEmision: '2026-01-10T00:00:00.000Z', direccion: 'COMPRA' }),
        factura({ fechaEmision: '2026-01-20T00:00:00.000Z', direccion: 'VENTA' }),
        factura({ fechaEmision: '2026-02-01T00:00:00.000Z', direccion: 'COMPRA' }),
      ],
      new Date(2026, 0, 1),
      new Date(2026, 1, 28),
      false,
    );

    expect(serie[0]).toMatchObject({ mes: '2026-01', compras: 100, ventas: 100 });
    expect(serie[1]).toMatchObject({ mes: '2026-02', compras: 100, ventas: 0 });
  });

  it('ignora fechas ausentes o ilegibles sin tirar el grafico', () => {
    const serie = calcularSerieMensual(
      [factura({ fechaEmision: null }), factura({ fechaEmision: 'vaya fecha' })],
      new Date(2026, 0, 1),
      new Date(2026, 0, 31),
      false,
    );

    expect(serie[0]?.compras).toBe(0);
  });
});

describe('agruparPor', () => {
  const conProveedor = [
    factura({ contraparte: 'Nubbitel', base: { amountMicros: 300_000_000 } }),
    factura({ contraparte: 'Gespurin', base: { amountMicros: 100_000_000 } }),
    factura({ contraparte: 'Gespurin', base: { amountMicros: 100_000_000 } }),
  ];

  const porContraparte = (f: FacturaPanel) =>
    f.contraparte ? { id: f.contraparte, nombre: f.contraparte } : null;

  it('ordena por importe de mayor a menor', () => {
    const filas = agruparPor(conProveedor, porContraparte, 'importe', false);

    expect(filas.map((f) => f.nombre)).toEqual(['Nubbitel', 'Gespurin']);
    expect(filas[0]?.importe).toBe(300);
  });

  it('ordena por numero de documentos', () => {
    const filas = agruparPor(conProveedor, porContraparte, 'documentos', false);

    expect(filas[0]?.nombre).toBe('Gespurin');
    expect(filas[0]?.documentos).toBe(2);
  });

  it('ordena por nombre respetando el alfabeto espanol', () => {
    const filas = agruparPor(
      [factura({ contraparte: 'Ñandú SL' }), factura({ contraparte: 'Naviera SA' })],
      porContraparte,
      'nombre',
      false,
    );

    expect(filas.map((f) => f.nombre)).toEqual(['Naviera SA', 'Ñandú SL']);
  });

  it('agrupa por la magnitud elegida', () => {
    const coherentes = [
      factura({
        contraparte: 'Nubbitel',
        base: { amountMicros: 300_000_000 },
        total: { amountMicros: 363_000_000 },
      }),
    ];

    expect(agruparPor(coherentes, porContraparte, 'importe', false)[0]?.importe).toBe(300);
    expect(agruparPor(coherentes, porContraparte, 'importe', true)[0]?.importe).toBe(363);
  });

  it('deja fuera lo que no tiene clave, en vez de agrupar bajo vacio', () => {
    const filas = agruparPor([factura({ contraparte: null })], porContraparte, 'importe', false);

    expect(filas).toEqual([]);
  });
});

describe('escalaBonita', () => {
  it('da valores redondos que se leen de cabeza', () => {
    // Repartir el maximo en cuatro daria 310 mil / 621 mil / 931 mil: exactos
    // e inutiles para estimar la altura de una barra.
    expect(escalaBonita(1_242_000)).toEqual([500_000, 1_000_000, 1_500_000]);
    expect(escalaBonita(3_200_000)).toEqual([1e6, 2e6, 3e6, 4e6]);
    expect(escalaBonita(829)).toEqual([250, 500, 750, 1000]);
  });

  it('la ultima marca siempre cubre el maximo', () => {
    for (const maximo of [1, 99, 121, 45_000, 1_242_000, 7_654_321]) {
      const marcas = escalaBonita(maximo);

      expect(marcas.at(-1)).toBeGreaterThanOrEqual(maximo);
    }
  });

  it('sin datos no devuelve marcas, en vez de un eje inventado', () => {
    expect(escalaBonita(0)).toEqual([]);
    expect(escalaBonita(-5)).toEqual([]);
    expect(escalaBonita(Number.NaN)).toEqual([]);
  });
});

describe('calcularIva', () => {
  // La cifra del modelo trimestral. Antes no estaba en el panel: habia que
  // abrir la lista, filtrar por direccion y sumar a mano.
  it('separa el soportado del repercutido y da la diferencia', () => {
    const r = calcularIva([
      factura({ direccion: 'COMPRA', iva: { amountMicros: 21_000_000 } }),
      factura({ direccion: 'COMPRA', iva: { amountMicros: 10_000_000 } }),
      factura({ direccion: 'VENTA', iva: { amountMicros: 50_000_000 } }),
    ]);

    expect(r.soportado).toBe(31);
    expect(r.repercutido).toBe(50);
    expect(r.diferencia).toBe(19);
  });

  it('una direccion desconocida no cuenta en ninguno de los dos', () => {
    const r = calcularIva([factura({ direccion: 'DESCONOCIDA' })]);

    expect(r.soportado).toBe(0);
    expect(r.repercutido).toBe(0);
  });
});

describe('calcularAntiguedad', () => {
  const hoy = new Date(2026, 5, 15);
  const haceDias = (dias: number) =>
    new Date(hoy.getTime() - dias * 86_400_000).toISOString();

  // "62 sin contabilizar" no dice si son de esta semana o llevan medio ano.
  it('reparte lo pendiente por lo que lleva esperando', () => {
    const tramos = calcularAntiguedad(
      [
        factura({ contabilizada: false, fechaEmision: haceDias(5) }),
        factura({ contabilizada: false, fechaEmision: haceDias(45) }),
        factura({ contabilizada: false, fechaEmision: haceDias(200) }),
      ],
      hoy,
      false,
    );

    expect(tramos.map((t) => t.id)).toEqual(['reciente', 'medio', 'viejo']);
    expect(tramos.every((t) => t.documentos === 1)).toBe(true);
  });

  it('lo ya contabilizado no aparece', () => {
    expect(
      calcularAntiguedad([factura({ contabilizada: true })], hoy, false),
    ).toEqual([]);
  });

  it('sin fecha va a su propio tramo, no se descarta', () => {
    const tramos = calcularAntiguedad(
      [factura({ contabilizada: false, fechaEmision: null })],
      hoy,
      false,
    );

    expect(tramos).toHaveLength(1);
    expect(tramos[0]?.id).toBe('sinFecha');
  });

  it('los tramos vacios no se pintan', () => {
    const tramos = calcularAntiguedad(
      [factura({ contabilizada: false, fechaEmision: haceDias(2) })],
      hoy,
      false,
    );

    expect(tramos).toHaveLength(1);
  });
});
