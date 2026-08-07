import { render, screen } from '@testing-library/react';

import { CambiosDeRelectura } from '@/documento/components/CambiosDeRelectura';

// Los valores viajan como los guarda el CRM: importes en micros y fechas con
// hora. Pintarlos en crudo obligaría a interpretar "241260000" para saber si el
// cambio está bien, que es justo lo que esta pantalla existe para evitar.
describe('CambiosDeRelectura', () => {
  const props = {
    aplicando: false,
    alConfirmar: jest.fn(),
    alCancelar: jest.fn(),
  };

  it('enseña los importes en euros, no en micros', () => {
    render(
      <CambiosDeRelectura
        {...props}
        cambios={[
          {
            campo: 'total',
            etiqueta: 'Total',
            antes: { amountMicros: 275_400_000 },
            despues: { amountMicros: 241_260_000 },
          },
        ]}
      />,
    );

    // El separador antes del € es un espacio duro. Testing Library normaliza
    // el del DOM a un espacio normal, asi que hay que normalizar el esperado
    // tambien o no casan nunca.
    const enEuros = (importe: number) =>
      new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        useGrouping: 'always',
      })
        .format(importe)
        .replace(/\u00a0/g, ' ');

    expect(screen.getByText(enEuros(275.4))).toBeInTheDocument();
    expect(screen.getByText(enEuros(241.26))).toBeInTheDocument();
  });

  it('enseña las fechas en formato de aquí', () => {
    render(
      <CambiosDeRelectura
        {...props}
        cambios={[
          {
            campo: 'fechaEmision',
            etiqueta: 'Fecha de la factura',
            antes: null,
            despues: '2026-01-05T00:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('05/01/2026')).toBeInTheDocument();
    // Un valor que no existía se marca, no se deja en blanco.
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('dice cuántos datos cambian, y el plural cuadra', () => {
    const { rerender } = render(
      <CambiosDeRelectura
        {...props}
        cambios={[{ campo: 'total', etiqueta: 'Total', antes: 1, despues: 2 }]}
      />,
    );

    expect(screen.getByText(/1 dato\. Nada más\./)).toBeInTheDocument();

    rerender(
      <CambiosDeRelectura
        {...props}
        cambios={[
          { campo: 'total', etiqueta: 'Total', antes: 1, despues: 2 },
          { campo: 'base', etiqueta: 'Base imponible', antes: 3, despues: 4 },
        ]}
      />,
    );

    expect(screen.getByText(/2 datos\. Nada más\./)).toBeInTheDocument();
  });

  it('mientras guarda no se puede pulsar dos veces', () => {
    render(
      <CambiosDeRelectura
        {...props}
        aplicando
        cambios={[{ campo: 'total', etiqueta: 'Total', antes: 1, despues: 2 }]}
      />,
    );

    expect(screen.getByRole('button', { name: /Guardando/ })).toBeDisabled();
  });
});

// Con muchos campos cambiados la lista podría crecer sin fin y dejar los
// botones fuera de la pantalla, sin forma de confirmar ni de cancelar.
describe('con muchos cambios', () => {
  const muchos = Array.from({ length: 25 }, (_, i) => ({
    campo: `campo${i}`,
    etiqueta: `Campo ${i}`,
    antes: `viejo ${i}`,
    despues: `nuevo ${i}`,
  }));

  it('los botones siguen ahí y la lista es la que se desplaza', () => {
    render(
      <CambiosDeRelectura
        cambios={muchos}
        aplicando={false}
        alConfirmar={jest.fn()}
        alCancelar={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Aplicar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dejarlo/ })).toBeInTheDocument();
    expect(screen.getByText('Campo 24')).toBeInTheDocument();
  });

  it('el diálogo se monta en el body, no donde vive el componente', () => {
    // position: fixed se ancla al ancestro con transform o filter, no al
    // viewport: dentro del visor, el modal salía encajado en el recuadro del
    // documento en vez de sobre la pantalla.
    const { container } = render(
      <CambiosDeRelectura
        cambios={muchos.slice(0, 2)}
        aplicando={false}
        alConfirmar={jest.fn()}
        alCancelar={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
