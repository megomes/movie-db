"use client";

import { useCallback, useEffect, useRef } from "react";

// Quanto tempo cada screenshot fica na tela ao segurar a capa no celular (escolhido no Perfil, guardado neste aparelho)
export const SHOT_SPEED_KEY = "shot-speed-ms";
export const SHOT_SPEEDS = [
  { ms: 300, label: "Bem rápido", hint: "0,3 s" },
  { ms: 500, label: "Rápido", hint: "0,5 s" },
  { ms: 800, label: "Médio", hint: "0,8 s" },
  { ms: 1200, label: "Devagar", hint: "1,2 s" },
] as const;
export const DEFAULT_SHOT_SPEED = 500;

export function readShotSpeed(): number {
  try {
    const v = Number(localStorage.getItem(SHOT_SPEED_KEY));
    return SHOT_SPEEDS.some((s) => s.ms === v) ? v : DEFAULT_SHOT_SPEED;
  } catch {
    return DEFAULT_SHOT_SPEED;
  }
}

// Engole o clique que o navegador manda ao soltar o dedo depois de segurar (senão abriria o link do card)
export function swallowNextClick() {
  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("click", stop, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 700);
}

const START_MS = 200;

/**
 * Segurar o dedo na capa (celular) passa as screenshots sozinho, uma a cada X ms (do Perfil), até soltar.
 * Toque rápido continua abrindo o card; mexer o dedo antes de começar (rolar a tela) cancela.
 */
export function useHoldScrub(shots: string[], setShot: (i: number | null) => void) {
  const st = useRef<{ start: number; tick: number; x: number; y: number; on: boolean } | null>(null);
  const preloaded = useRef(false);
  const latest = useRef({ shots, setShot });
  useEffect(() => {
    latest.current = { shots, setShot };
  });

  const stop = useCallback(() => {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.start);
    clearInterval(s.tick);
    st.current = null;
    if (s.on) {
      latest.current.setShot(null);
      swallowNextClick();
    }
  }, []);
  useEffect(() => stop, [stop]);

  if (!shots.length) return {};
  return {
    onTouchStart: (e: React.TouchEvent) => {
      stop();
      if (e.touches.length !== 1) return;
      if (!preloaded.current) {
        preloaded.current = true;
        for (const src of shots) new Image().src = src;
      }
      const t = e.touches[0];
      const s = { start: 0, tick: 0, x: t.clientX, y: t.clientY, on: false };
      s.start = window.setTimeout(() => {
        s.on = true;
        let i = 0;
        latest.current.setShot(0);
        navigator.vibrate?.(8);
        s.tick = window.setInterval(() => {
          i = (i + 1) % latest.current.shots.length;
          latest.current.setShot(i);
        }, readShotSpeed());
      }, START_MS);
      st.current = s;
    },
    onTouchMove: (e: React.TouchEvent) => {
      const s = st.current;
      const t = e.touches[0];
      if (s && !s.on && Math.hypot(t.clientX - s.x, t.clientY - s.y) > 10) stop();
    },
    onTouchEnd: stop,
    onTouchCancel: stop,
  };
}
