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

