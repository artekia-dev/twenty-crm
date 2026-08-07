import {
  agruparPor,
  calcularResumen,
  calcularSerieMensual,
} from '@/panel/datos/resumenPanel';
import { type FacturaPanel } from '@/panel/datos/usePanelFacturas';

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
    ]);

    expect(r.compras).toBe(100);
    expect(r.ventas).toBe(250);
    expect(r.numeroFacturas).toBe(2);
  });

  // Sin base no se puede comparar con nada, pero el total sigue siendo un dato
  // real del documento: mejor contarlo que dejar la cifra a cero.
  it('usa el total cuando no hay base', () => {
    const r = calcularResumen([
      factura({ base: { amountMicros: 0 }, total: { amountMicros: 121_000_000 } }),
    ]);

    expect(r.compras).toBe(121);
  });

  it('cuenta lo que queda por contabilizar, con su importe', () => {
    const r = calcularResumen([
      factura({ contabilizada: false }),
      factura({ contabilizada: null }),
      factura({ contabilizada: true }),
    ]);

    expect(r.pendientesDeContabilizar).toBe(2);
    expect(r.importePendiente).toBe(242);
  });

  // "Cuanto debemos" son las compras sin pagar. Una venta sin cobrar es otra
  // pregunta y se responde en otro sitio.
  it('lo pendiente de pago son solo las compras', () => {
    const r = calcularResumen([
      factura({ direccion: 'COMPRA', pagada: false }),
      factura({ direccion: 'VENTA', pagada: false }),
    ]);

    expect(r.pendientesDePago).toBe(1);
    expect(r.importePendienteDePago).toBe(121);
  });

  it('cuenta avisos, huerfanas y sin direccion', () => {
    const r = calcularResumen([
      factura({ avisoSociedad: 'CIF_NO_COINCIDE' }),
      factura({ avisoTipo: 'VARIOS_EN_ARCHIVO' }),
      factura({ sociedadId: null }),
      factura({ direccion: 'DESCONOCIDA' }),
      factura({ direccion: null }),
    ]);

    expect(r.conAviso).toBe(2);
    expect(r.sinSociedad).toBe(1);
    expect(r.sinDireccion).toBe(2);
  });

  it('sin facturas devuelve ceros y no revienta', () => {
    const r = calcularResumen([]);

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
    );

    expect(serie[0]).toMatchObject({ mes: '2026-01', compras: 100, ventas: 100 });
    expect(serie[1]).toMatchObject({ mes: '2026-02', compras: 100, ventas: 0 });
  });

  it('ignora fechas ausentes o ilegibles sin tirar el grafico', () => {
    const serie = calcularSerieMensual(
      [factura({ fechaEmision: null }), factura({ fechaEmision: 'vaya fecha' })],
      new Date(2026, 0, 1),
      new Date(2026, 0, 31),
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
    const filas = agruparPor(conProveedor, porContraparte, 'importe');

    expect(filas.map((f) => f.nombre)).toEqual(['Nubbitel', 'Gespurin']);
    expect(filas[0]?.importe).toBe(300);
  });

  it('ordena por numero de documentos', () => {
    const filas = agruparPor(conProveedor, porContraparte, 'documentos');

    expect(filas[0]?.nombre).toBe('Gespurin');
    expect(filas[0]?.documentos).toBe(2);
  });

  it('ordena por nombre respetando el alfabeto espanol', () => {
    const filas = agruparPor(
      [factura({ contraparte: 'Ñandú SL' }), factura({ contraparte: 'Naviera SA' })],
      porContraparte,
      'nombre',
    );

    expect(filas.map((f) => f.nombre)).toEqual(['Naviera SA', 'Ñandú SL']);
  });

  it('deja fuera lo que no tiene clave, en vez de agrupar bajo vacio', () => {
    const filas = agruparPor([factura({ contraparte: null })], porContraparte, 'importe');

    expect(filas).toEqual([]);
  });
});
