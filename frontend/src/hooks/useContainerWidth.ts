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
 * hook para detectar si los hijos del contenedor se desbordan horizontalmente
 * retorna true si los hijos necesitan más espacio que el disponible
 * funciona con contenedores que tienen overflow-hidden midiendo el tamaño natural de los hijos
 * usa hysteresis para prevenir toggle continuo entre estados
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
      // calcular el ancho total necesario por los hijos directos
      let totalChildrenWidth = 0;
      const children = Array.from(element.children) as HTMLElement[];

      children.forEach((child) => {
        // usar scrollWidth del hijo para obtener su ancho natural (sin overflow)
        // getBoundingClientRect es más preciso para elementos flex
        const rect = child.getBoundingClientRect();
        totalChildrenWidth += rect.width;
      });

      // obtener gap del contenedor flex si existe
      const computedStyle = window.getComputedStyle(element);
      const gap = parseFloat(computedStyle.gap) || 0;
      const gapTotal = gap * Math.max(0, children.length - 1);

      totalChildrenWidth += gapTotal;

      const availableWidth = element.clientWidth;

      // usar hysteresis para prevenir toggle continuo:
      // - para ACTIVAR overflow: necesitamos que el contenido sea > ancho disponible
      // - para DESACTIVAR overflow: necesitamos espacio extra (~150px para labels de botones)
      // esto previene el loop: overflow -> hide labels -> shrink -> no overflow -> show labels -> overflow...
      const BUFFER_ZONE = 150; // espacio adicional necesario para volver a mostrar labels

      if (isOverflowing) {
        // ya estamos en overflow, solo salir si hay suficiente espacio EXTRA
        const hasEnoughSpace = totalChildrenWidth + BUFFER_ZONE <= availableWidth;
        if (hasEnoughSpace) {
          setIsOverflowing(false);
        }
      } else {
        // no hay overflow, solo entrar si realmente hay overflow
        const hasOverflow = totalChildrenWidth > availableWidth + 1;
        if (hasOverflow) {
          setIsOverflowing(true);
        }
      }
    };

    // revisar overflow inicial con un pequeño delay para asegurar que el layout esté completo
    const initialTimeout = setTimeout(checkOverflow, 0);

    const resizeObserver = new ResizeObserver(() => {
      checkOverflow();
    });

    resizeObserver.observe(element);

    // observar todos los hijos directos para detectar cambios de tamaño
    const childObservers: ResizeObserver[] = [];
    Array.from(element.children).forEach((child) => {
      const observer = new ResizeObserver(() => {
        checkOverflow();
      });
      observer.observe(child);
      childObservers.push(observer);
    });

    // también observar cambios en el contenido usando MutationObserver
    const mutationObserver = new MutationObserver(() => {
      // limpiar observers antiguos de hijos
      childObservers.forEach((obs) => obs.disconnect());
      childObservers.length = 0;

      // crear nuevos observers para nuevos hijos
      Array.from(element.children).forEach((child) => {
        const observer = new ResizeObserver(() => {
          checkOverflow();
        });
        observer.observe(child);
        childObservers.push(observer);
      });

      checkOverflow();
    });

    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      clearTimeout(initialTimeout);
      resizeObserver.disconnect();
      childObservers.forEach((obs) => obs.disconnect());
      mutationObserver.disconnect();
    };
  }, []);

  return [isOverflowing, containerRef];
}
