import { useLayoutEffect, useRef, useState } from 'react';

// Ancho real del contenedor, en pixeles.
//
// Los graficos se dibujan en coordenadas reales en vez de estirar un viewBox
// fijo. Estirarlo es una linea de codigo menos, pero deforma el texto de los
// ejes en horizontal —y cuanto mas estrecha la pantalla, mas se deforma, justo
// donde peor se lee ya. Midiendo el contenedor cada etiqueta sale redonda y
// ademas se puede decidir cuantas caben, que en un movil es la diferencia entre
// un eje legible y una fila de palotes pisados.

export const useAnchoContenedor = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [ancho, setAncho] = useState(0);

  useLayoutEffect(() => {
    const elemento = ref.current;

    if (!elemento) return;

    const observador = new ResizeObserver(([entrada]) => {
      if (entrada) setAncho(entrada.contentRect.width);
    });

    observador.observe(elemento);
    setAncho(elemento.getBoundingClientRect().width);

    return () => observador.disconnect();
  }, []);

  return { ref, ancho };
};
