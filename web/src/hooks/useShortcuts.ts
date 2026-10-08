import { useEffect, useRef } from "react";

interface Transport {
  toggle: () => void | Promise<void>;
  seek: (t: number) => void;
  skip: (delta: number) => void;
  /** Onde o "início" fica: começo do trecho selecionado (ou 0 sem seleção). */
  homeTime: () => number;
}

const SKIP = 1; // segundos por seta
const SKIP_BIG = 5; // com Shift

/** Atalhos do player: Espaço = tocar/pausar, Home = início, ←/→ = voltar/avançar (Shift = passo maior). */
export function useShortcuts(transport: Transport) {
  // O objeto do player muda a cada quadro; a ref evita reinstalar o listener o tempo todo.
  const ref = useRef(transport);
  ref.current = transport;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = ref.current;
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      // Não atrapalha a digitação, listas/sliders nem o diálogo de progresso aberto
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("dialog[open]")) return;

      switch (e.code) {
        case "Space":
          // Se um botão está focado, o Espaço também o "clicaria": tira o foco antes
          if (el?.tagName === "BUTTON") el.blur();
          e.preventDefault();
          void t.toggle();
          break;
        case "Home":
          e.preventDefault();
          t.seek(t.homeTime());
          break;
        case "ArrowLeft":
          e.preventDefault();
          t.skip(e.shiftKey ? -SKIP_BIG : -SKIP);
          break;
        case "ArrowRight":
          e.preventDefault();
          t.skip(e.shiftKey ? SKIP_BIG : SKIP);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
