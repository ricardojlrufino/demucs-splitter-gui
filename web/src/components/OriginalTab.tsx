import { Waveform } from "./Waveform";
import { Transport } from "./Transport";
import { EnvPanel } from "./EnvPanel";
import { FormatSelect, extOf, useExportFormat } from "./FormatSelect";
import { ProgressDialog, type BusyState } from "./ProgressDialog";
import { usePlayer } from "../hooks/usePlayer";
import { useShortcuts } from "../hooks/useShortcuts";
import { formatTime, rangeTag } from "../dsp/wav";
import type { Range } from "../audio/player";
import { MODELS, type Device } from "../lib/models";
import { downloadStem, type Environment } from "../lib/backend";

interface Props {
  ctx: AudioContext;
  fileName: string;
  /** Áudio vindo do YouTube: oferece baixá-lo (em MP3/OGG/WAV). Nulo para arquivos locais. */
  downloadable: { wav: string } | null;
  formats: string[];
  buffer: AudioBuffer;
  buffers: AudioBuffer[];
  selection: Range;
  onSelect: (r: Range | null) => void;
  modelId: string;
  onModelChange: (id: string) => void;
  env: Environment | null;
  device: Device;
  onDeviceChange: (d: Device) => void;
  demucsPath: string;
  onDemucsPathChange: (p: string) => void;
  onRecheck: () => void;
  busy: BusyState | null;
  error: string | null;
  onSeparate: () => void;
  onCancel: () => void;
  onNewFile: () => void;
}

export function OriginalTab(p: Props) {
  const pl = usePlayer(p.ctx, p.buffers, p.selection);
  const [format, setFormat] = useExportFormat(p.formats);
  useShortcuts(pl);
  const model = MODELS.find((m) => m.id === p.modelId)!;
  const dur = p.selection.end - p.selection.start;
  const isFull = p.selection.start <= 0.001 && p.selection.end >= p.buffer.duration - 0.001;
  const canRun = !!p.env?.demucs && !!p.env?.ffmpeg;

  return (
    <div className="tab-body">
      <div className="file-row">
        <div>
          <div className="file-name">{p.fileName}</div>
          <div className="muted mono">{formatTime(p.buffer.duration)}</div>
        </div>
        <button className="btn ghost" onClick={p.onNewFile} disabled={!!p.busy}>Trocar arquivo</button>
      </div>

      {p.downloadable && (
        <div className="yt-download">
          <span className="muted">Áudio importado do YouTube:</span>
          <FormatSelect formats={p.formats} value={format} onChange={setFormat} />
          <button
            className="btn ghost"
            onClick={() => {
              const base = p.fileName.replace(/\.[^.]+$/, "");
              const tag = isFull ? "" : rangeTag(p.selection.start, p.selection.end);
              downloadStem(p.downloadable!.wav, `${base}${tag}.${extOf(format)}`, format, isFull ? null : p.selection);
            }}
          >
            {isFull ? "Baixar áudio" : "Baixar trecho selecionado"}
          </button>
        </div>
      )}

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
            {isFull
              ? "Arquivo inteiro"
              : `Trecho ${formatTime(p.selection.start)} → ${formatTime(p.selection.end)} (${formatTime(dur)})`}
            {!isFull && (
              <button className="link" onClick={() => p.onSelect(null)}>selecionar tudo</button>
            )}
          </span>
        </Transport>
      </div>

      <h3 className="section-title">Modelo</h3>
      <div className="models">
        {MODELS.map((m) => (
          <div
            key={m.id}
            className={`model-card${m.id === p.modelId ? " selected" : ""}`}
            onClick={() => !p.busy && p.onModelChange(m.id)}
          >
            <div className="model-name">{m.label}</div>
            <div className="model-desc">{m.description}</div>
          </div>
        ))}
      </div>

      <h3 className="section-title">Ambiente</h3>
      <EnvPanel
        env={p.env}
        device={p.device}
        onDeviceChange={p.onDeviceChange}
        demucsPath={p.demucsPath}
        onDemucsPathChange={p.onDemucsPathChange}
        onRecheck={p.onRecheck}
      />

      {p.error && <div className="alert pre">{p.error}</div>}

      <div className="action-row">
        <button
          className="btn primary"
          disabled={!canRun || !!p.busy}
          onClick={() => {
            pl.stop();
            p.onSeparate();
          }}
        >
          Separar {isFull ? "arquivo inteiro" : "trecho selecionado"} ({formatTime(dur)})
        </button>
      </div>

      {p.busy && (
        <ProgressDialog
          busy={p.busy}
          modelLabel={model.label}
          duration={dur}
          onCancel={p.onCancel}
        />
      )}
    </div>
  );
}
