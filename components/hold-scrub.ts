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
 * Toque rápido continua abrindo o card; arrastar o dedo (rolar a tela), antes ou durante, para tudo.
 * O fim do toque e a rolagem são ouvidos na janela: rolando, o navegador pode nem mandar o touchend para o card.
 */
export function useHoldScrub(shots: string[], setShot: (i: number | null) => void) {
  const st = useRef<{ start: number; tick: number; x: number; y: number; on: boolean; off: () => void } | null>(null);
  const preloaded = useRef(false);
  const latest = useRef({ shots, setShot });
  useEffect(() => {
    latest.current = { shots, setShot };
  });

  // released: soltou o dedo parado (aí engole o clique que viria); arrastou/rolou: só para
  const stop = useCallback((released = false) => {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.start);
    clearInterval(s.tick);
    s.off();
    st.current = null;
    if (s.on) {
      latest.current.setShot(null);
      if (released) swallowNextClick();
    }
  }, []);
  useEffect(() => () => stop(), [stop]);

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
      const release = () => stop(true);
      const cancel = () => stop();
      const move = (ev: TouchEvent) => {
        const p = ev.touches[0];
        if (!p || Math.hypot(p.clientX - s.x, p.clientY - s.y) > 10) stop();
      };
      const opts = { capture: true, passive: true } as const;
      window.addEventListener("touchend", release, opts);
      window.addEventListener("touchcancel", cancel, opts);
      window.addEventListener("touchmove", move, opts);
      window.addEventListener("scroll", cancel, opts);
      const s = {
        start: 0,
        tick: 0,
        x: t.clientX,
        y: t.clientY,
        on: false,
        off: () => {
          window.removeEventListener("touchend", release, opts);
          window.removeEventListener("touchcancel", cancel, opts);
          window.removeEventListener("touchmove", move, opts);
          window.removeEventListener("scroll", cancel, opts);
        },
      };
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
  };
}
