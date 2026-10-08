import { useEffect, useRef } from "react";

export interface BusyState {
  phase: "download" | "separate";
  progress: number;
  elapsed: number;
  status: string;
}

interface Props {
  busy: BusyState;
  modelLabel: string;
  modelSizeMb: number;
  duration: number;
  onCancel: () => void;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Diálogo modal (bloqueia a interface) com o progresso do download do modelo e da separação. */
export function ProgressDialog({ busy, modelLabel, modelSizeMb, duration, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const pct = Math.max(0, Math.min(100, busy.progress));
  const preparing = pct === 0;
  const eta =
    busy.phase === "separate" && pct > 2 && pct < 100 ? (busy.elapsed * (100 - pct)) / pct : null;

  const title = busy.phase === "download" ? "Baixando o modelo" : "Separando as pistas";
  const detail = preparing
    ? "Preparando…"
    : busy.phase === "download"
      ? `${modelLabel} · ${modelSizeMb} MB (só na primeira vez)`
      : `${modelLabel} · áudio de ${mmss(duration)}`;

  return (
    <dialog
      ref={ref}
      className="progress-dialog"
      aria-labelledby="pd-title"
      onCancel={(e) => e.preventDefault()} // Esc não fecha: use o botão Cancelar
    >
      <h2 id="pd-title">{title}</h2>
      <p className="muted">{detail}</p>

      <div
        className={`bar big${preparing ? " indeterminate" : ""}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={preparing ? undefined : Math.round(pct)}
      >
        <div style={{ width: preparing ? undefined : `${pct}%` }} />
      </div>

      <div className="pd-stats mono">
        <span className="pd-pct">{preparing ? "—" : `${Math.round(pct)}%`}</span>
        <span>decorrido {mmss(busy.elapsed)}</span>
        <span>{eta != null ? `restante ~${mmss(eta)}` : ""}</span>
      </div>

      {busy.status && <p className="pd-status mono muted" title={busy.status}>{busy.status}</p>}

      <div className="pd-actions">
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </dialog>
  );
}
