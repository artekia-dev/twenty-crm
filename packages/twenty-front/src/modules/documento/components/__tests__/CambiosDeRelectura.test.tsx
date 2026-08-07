import { fireEvent, render, screen } from '@testing-library/react';

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
            id: '0:total',
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
            id: '0:fechaEmision',
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
        cambios={[{ id: '0:total', campo: 'total', etiqueta: 'Total', antes: 1, despues: 2 }]}
      />,
    );

    expect(screen.getByText(/1 dato\. Nada más\./)).toBeInTheDocument();

    rerender(
      <CambiosDeRelectura
        {...props}
        cambios={[
          { id: '0:total', campo: 'total', etiqueta: 'Total', antes: 1, despues: 2 },
          { id: '0:base', campo: 'base', etiqueta: 'Base imponible', antes: 3, despues: 4 },
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
        cambios={[{ id: '0:total', campo: 'total', etiqueta: 'Total', antes: 1, despues: 2 }]}
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
    id: `0:campo${i}`,
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

// Poder quedarse con unos cambios y rechazar otros: aceptar el importe nuevo
// pero no el CIF, por ejemplo. Lo que se manda son los campos elegidos; los
// valores salen siempre de la propuesta que ya se calculó.
describe('elegir qué se cambia', () => {
  const dos = [
    { id: '0:base', campo: 'base', etiqueta: 'Base imponible', antes: 1, despues: 2 },
    { id: '0:cifEmisor', campo: 'cifEmisor', etiqueta: 'CIF de quien emite', antes: 'A', despues: 'B' },
  ];

  it('todo viene marcado y se confirman los dos', () => {
    const alConfirmar = jest.fn();

    render(
      <CambiosDeRelectura
        cambios={dos}
        aplicando={false}
        alConfirmar={alConfirmar}
        alCancelar={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));

    expect(alConfirmar).toHaveBeenCalledWith(['0:base', '0:cifEmisor']);
  });

  it('desmarcar el CIF lo deja fuera', () => {
    const alConfirmar = jest.fn();

    render(
      <CambiosDeRelectura
        cambios={dos}
        aplicando={false}
        alConfirmar={alConfirmar}
        alCancelar={jest.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));

    expect(alConfirmar).toHaveBeenCalledWith(['0:base']);
  });

  it('sin nada marcado no se puede aplicar', () => {
    render(
      <CambiosDeRelectura
        cambios={dos}
        aplicando={false}
        alConfirmar={jest.fn()}
        alCancelar={jest.fn()}
      />,
    );

    screen.getAllByRole('checkbox').forEach((casilla) => fireEvent.click(casilla));

    expect(screen.getByText(/no se cambiará nada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aplicar/ })).toBeDisabled();
  });

  it('un cambio que llega despues nace elegido', () => {
    const alConfirmar = jest.fn();
    const { rerender } = render(
      <CambiosDeRelectura
        cambios={[dos[0]]}
        aplicando={false}
        alConfirmar={alConfirmar}
        alCancelar={jest.fn()}
      />,
    );

    rerender(
      <CambiosDeRelectura
        cambios={dos}
        aplicando={false}
        alConfirmar={alConfirmar}
        alCancelar={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));

    expect(alConfirmar).toHaveBeenCalledWith(['0:base', '0:cifEmisor']);
  });

  it('el contador sigue a lo elegido, no a lo propuesto', () => {
    render(
      <CambiosDeRelectura
        cambios={dos}
        aplicando={false}
        alConfirmar={jest.fn()}
        alCancelar={jest.fn()}
      />,
    );

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByText(/1 dato\. Nada más\./)).toBeInTheDocument();
  });
});

// Un PDF con dos facturas produce dos documentos, y los dos pueden cambiar el
// proveedor. Si la eleccion fuera por nombre de campo, desmarcar uno desmarcaria
// el otro y se guardaria algo que nadie aprobo.
it('desmarcar un campo no toca el mismo campo de otro documento', () => {
  const alConfirmar = jest.fn();

  render(
    <CambiosDeRelectura
      cambios={[
        { id: '0:total', campo: 'total', etiqueta: 'Total', antes: 1, despues: 2 },
        { id: '1:total', campo: 'total', etiqueta: 'Total', antes: 3, despues: 4 },
      ]}
      aplicando={false}
      alConfirmar={alConfirmar}
      alCancelar={jest.fn()}
    />,
  );

  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));

  expect(alConfirmar).toHaveBeenCalledWith(['1:total']);
});
