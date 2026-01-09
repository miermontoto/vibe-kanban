import { useState, useEffect, useRef, RefObject } from 'react';

/**
 * hook para detectar el ancho del contenedor usando ResizeObserver
 * retorna el ancho actual y una referencia para asignar al elemento
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>(): [
  number,
  RefObject<T>
] {
  const [width, setWidth] = useState(0);
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // usar contentBoxSize si está disponible para mejor performance
        if (entry.contentBoxSize) {
          const contentBoxSize = Array.isArray(entry.contentBoxSize)
            ? entry.contentBoxSize[0]
            : entry.contentBoxSize;
          setWidth(contentBoxSize.inlineSize);
        } else {
          // fallback a contentRect
          setWidth(entry.contentRect.width);
        }
      }
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return [width, containerRef];
}

/**
 * hook para detectar si el contenedor tiene overflow horizontal
 * retorna true si el contenido es más ancho que el espacio visible
 */
export function useContainerOverflow<T extends HTMLElement = HTMLDivElement>(): [
  boolean,
  RefObject<T>
] {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const containerRef = useRef<T>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const checkOverflow = () => {
      // scrollWidth incluye contenido oculto, clientWidth es el ancho visible
      const hasOverflow = element.scrollWidth > element.clientWidth;
      setIsOverflowing(hasOverflow);
    };

    // revisar overflow inicial
    checkOverflow();

    const resizeObserver = new ResizeObserver(() => {
      checkOverflow();
    });

    resizeObserver.observe(element);

    // también observar cambios en el contenido usando MutationObserver
    const mutationObserver = new MutationObserver(() => {
      checkOverflow();
    });

    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return [isOverflowing, containerRef];
}
