import { useState } from "react";
import { Waveform } from "./Waveform";
import { Transport } from "./Transport";
import { usePlayer } from "../hooks/usePlayer";
import { formatTime } from "../dsp/wav";
import type { Range } from "../audio/player";
import type { GpuStatus } from "../audio/webgpu";
import type { ModelVariant, StemId } from "../models/registry";
import type { DownloadState } from "../models/useModelStore";

interface Props {
  ctx: AudioContext;
  fileName: string;
  buffer: AudioBuffer;
  buffers: AudioBuffer[];
  selection: Range;
  onSelect: (r: Range | null) => void;
  models: readonly ModelVariant[];
  states: Record<string, DownloadState>;
  modelId: string;
  onModelChange: (id: string) => void;
  onDownload: (id: string) => void;
  stems: StemId[];
  onStemsChange: (s: StemId[]) => void;
  busy: { progress: number; elapsed: number } | null;
  error: string | null;
  onSeparate: () => void;
  onNewFile: () => void;
  gpu: GpuStatus;
}

const ALL_STEM_LABELS: Record<StemId, string> = {
  drums: "Bateria",
  bass: "Baixo",
  other: "Outros",
  vocals: "Vocais",
  guitar: "Guitarra",
  piano: "Piano",
};
export { ALL_STEM_LABELS };

function GpuWarning({ status }: { status: "unsupported" | "no-adapter" }) {
  const isChrome = /Chrome|Chromium|Edg\//.test(navigator.userAgent);
  return (
    <div className="gpu-warn">
      <strong>⚠ WebGPU indisponível</strong>
      <p>
        {status === "unsupported"
          ? "Este navegador não expõe a API WebGPU."
          : "O navegador tem WebGPU, mas não encontrou uma GPU compatível."}{" "}
        A separação pode ser <b>muito lenta</b> (sem aceleração de GPU) ou falhar.
      </p>
      {isChrome ? (
        <>
          <p>No Chrome/Edge, tente habilitar estas flags (cole na barra de endereços), reinicie o navegador e recarregue a página:</p>
          <ul className="mono">
            <li>chrome://flags/#enable-unsafe-webgpu → <b>Enabled</b></li>
            <li>chrome://flags/#enable-vulkan → <b>Enabled</b> (Linux)</li>
            <li>chrome://flags/#ignore-gpu-blocklist → <b>Enabled</b> (se a GPU estiver na lista de bloqueio)</li>
          </ul>
          <p>Confira também em <span className="mono">chrome://gpu</span> se "WebGPU" aparece como habilitado e se a aceleração de hardware está ligada nas configurações.</p>
        </>
      ) : (
        <p>Use uma versão recente do Chrome ou Edge (Firefox e Safari têm suporte parcial ou desabilitado por padrão).</p>
      )}
    </div>
  );
}

export function OriginalTab(p: Props) {
  const [, force] = useState(0);
  const pl = usePlayer(p.ctx, p.buffers, p.selection);
  const model = p.models.find((m) => m.id === p.modelId)!;
  const state = p.states[p.modelId];
  const ready = state?.status === "cached";
  const dur = p.selection.end - p.selection.start;
  const isFull = p.selection.start <= 0.001 && p.selection.end >= p.buffer.duration - 0.001;
  const selectableStems = model.id === "htdemucs_ft" || model.stems.length > 0;

  const toggleStem = (s: StemId) => {
    const next = p.stems.includes(s) ? p.stems.filter((x) => x !== s) : [...p.stems, s];
    p.onStemsChange(next);
    force((n) => n + 1);
  };

  return (
    <div className="tab-body">
      <div className="file-row">
        <div>
          <div className="file-name">{p.fileName}</div>
          <div className="muted mono">{formatTime(p.buffer.duration)} · {p.buffer.sampleRate / 1000} kHz</div>
        </div>
        <button className="btn ghost" onClick={p.onNewFile}>Trocar arquivo</button>
      </div>

      <div className="panel">
        <Waveform
          buffer={p.buffer}
          color="var(--wave)"
          height={150}
          time={pl.time}
          onSeek={pl.seek}
          selection={p.selection}
          onSelect={p.onSelect}
        />
        <p className="hint">Arraste na waveform para selecionar um trecho. Puxe a alça verde (início) ou vermelha (fim) para ajustar, arraste o miolo para mover o trecho, clique para posicionar o cursor.</p>
        <Transport
          playing={pl.playing}
          time={pl.time}
          duration={pl.duration}
          loop={pl.loop}
          onToggle={pl.toggle}
          onStop={pl.stop}
          onSkip={pl.skip}
          onLoop={pl.setLoop}
        >
          <span className="sel-info mono">
            {isFull ? "Arquivo inteiro" : `Trecho ${formatTime(p.selection.start)} → ${formatTime(p.selection.end)} (${formatTime(dur)})`}
            {!isFull && (
              <button className="link" onClick={() => p.onSelect(null)}>selecionar tudo</button>
            )}
          </span>
        </Transport>
      </div>

      <h3 className="section-title">Modelo</h3>
      <div className="models">
        {p.models.map((m) => {
          const st = p.states[m.id];
          const selected = m.id === p.modelId;
          return (
            <div
              key={m.id}
              className={`model-card${selected ? " selected" : ""}`}
              onClick={() => p.onModelChange(m.id)}
            >
              <div className="model-name">{m.label}</div>
              <div className="model-desc">{m.description}</div>
              <div className="model-size mono">{m.sizeMb} MB</div>
              <div className="model-status">
                {!st || st.status === "checking" ? (
                  <span className="muted">Verificando…</span>
                ) : st.status === "cached" ? (
                  <span className="ok">✓ Pronto</span>
                ) : st.status === "downloading" ? (
                  <span>
                    Baixando {st.progress != null ? `${Math.round(st.progress * 100)}%` : "…"}
                    <div className="bar"><div style={{ width: `${(st.progress ?? 0) * 100}%` }} /></div>
                  </span>
                ) : (
                  <button
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onDownload(m.id);
                    }}
                  >
                    {st.status === "error" ? `Erro: ${st.message} — tentar de novo` : "Clique para baixar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectableStems && (
        <>
          <h3 className="section-title">Pistas a extrair</h3>
          <div className="stem-chips">
            {model.stems.map((s) => (
              <label key={s} className={`chip stem-${s}${p.stems.includes(s) ? " on" : ""}`}>
                <input type="checkbox" checked={p.stems.includes(s)} onChange={() => toggleStem(s)} />
                {ALL_STEM_LABELS[s]}
              </label>
            ))}
          </div>
        </>
      )}

      {p.gpu === "ok" && <div className="gpu-badge ok">● WebGPU disponível — separação acelerada por GPU</div>}
      {(p.gpu === "unsupported" || p.gpu === "no-adapter") && <GpuWarning status={p.gpu} />}
      {p.error && <div className="alert">{p.error}</div>}

      <div className="action-row">
        {p.busy ? (
          <div className="progress-box">
            <div className="bar big"><div style={{ width: `${p.busy.progress * 100}%` }} /></div>
            <span className="mono muted">
              Separando… {Math.round(p.busy.progress * 100)}% · {p.busy.elapsed.toFixed(0)}s
            </span>
          </div>
        ) : (
          <button
            className="btn primary"
            disabled={!ready || p.stems.length === 0}
            onClick={() => {
              pl.stop();
              p.onSeparate();
            }}
          >
            Separar {isFull ? "arquivo inteiro" : "trecho selecionado"} ({formatTime(dur)})
          </button>
        )}
        {!ready && !p.busy && <span className="muted">Baixe o modelo selecionado para continuar.</span>}
      </div>
    </div>
  );
}
