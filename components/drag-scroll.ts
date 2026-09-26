"use client";

import { useCallback } from "react";

// Clicar e puxar com o mouse nas listas horizontais (o toque já rola sozinho).
// Durante o arraste o snap fica desligado; o clique logo depois de arrastar é engolido.
export function attachDragScroll(node: HTMLElement) {
  let down = false;
  let dragging = false;
  let startX = 0;
  let startLeft = 0;

  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true;
    dragging = false;
    startX = e.clientX;
    startLeft = node.scrollLeft;
  };
  const onMove = (e: PointerEvent) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) > 6) {
      dragging = true;
      node.setPointerCapture(e.pointerId);
      node.style.scrollSnapType = "none";
      node.style.scrollBehavior = "auto";
      node.style.cursor = "grabbing";
    }
    if (dragging) node.scrollLeft = startLeft - dx;
  };
  const onUp = () => {
    if (!down) return;
    down = false;
    if (!dragging) return;
    node.style.cursor = "";
    node.style.scrollBehavior = "";
    requestAnimationFrame(() => (node.style.scrollSnapType = ""));
    const swallow = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    node.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => node.removeEventListener("click", swallow, true), 60);
  };
  const noNativeDrag = (e: DragEvent) => e.preventDefault();

  node.addEventListener("pointerdown", onDown);
  node.addEventListener("pointermove", onMove);
  node.addEventListener("pointerup", onUp);
  node.addEventListener("pointercancel", onUp);
  node.addEventListener("dragstart", noNativeDrag);
  return () => {
    node.removeEventListener("pointerdown", onDown);
    node.removeEventListener("pointermove", onMove);
    node.removeEventListener("pointerup", onUp);
    node.removeEventListener("pointercancel", onUp);
    node.removeEventListener("dragstart", noNativeDrag);
  };
}

export function useDragScroll<T extends HTMLElement>() {
  return useCallback((node: T | null) => (node ? attachDragScroll(node) : undefined), []);
}
