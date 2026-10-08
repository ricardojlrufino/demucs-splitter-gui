import { useMemo, useState } from "react";
import { Waveform } from "./Waveform";
import { Transport } from "./Transport";
import { DownloadIcon } from "./Icons";
import { usePlayer } from "../hooks/usePlayer";
import { useShortcuts } from "../hooks/useShortcuts";
import { formatTime, rangeTag } from "../dsp/wav";
import { STEM_LABELS, type StemId } from "../lib/models";
import { downloadStem, downloadZip, type ExportRange } from "../lib/backend";
import type { Range } from "../audio/player";
import { FormatSelect, extOf, useExportFormat } from "./FormatSelect";

export interface StemResult {
  name: StemId;
  buffer: AudioBuffer;
  path: string;
}

interface Props {
  ctx: AudioContext;
  baseName: string;
  stems: StemResult[];
  offset: number;
  /** Formatos de exportação disponíveis (do melhor para o mais compatível). */
  formats: string[];
}

export function StemsTab({ ctx, baseName, stems, offset, formats }: Props) {
  const buffers = useMemo(() => stems.map((s) => s.buffer), [stems]);
  const total = stems[0].buffer.duration;
  const [selection, setSelection] = useState<Range>({ start: 0, end: total });
  const isFull = selection.start <= 0.001 && selection.end >= total - 0.001;
  const range: ExportRange | null = isFull ? null : selection;
  const pl = usePlayer(ctx, buffers, selection);
  useShortcuts(pl);
  const [vol, setVol] = useState<number[]>(() => stems.map(() => 1));
  const [mute, setMute] = useState<boolean[]>(() => stems.map(() => false));
  const [solo, setSolo] = useState<boolean[]>(() => stems.map(() => false));
  const [msg, setMsg] = useState<string | null>(null);
  const [format, setFormat] = useExportFormat(formats);

  const upd = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x));
  const suffix = range ? rangeTag(range.start, range.end) : "";
  const fileName = (s: StemResult) => `${baseName} - ${s.name}${suffix}.${extOf(format)}`;

  const saveOne = (s: StemResult) => {
    downloadStem(s.path, fileName(s), format, range);
    setMsg(`Baixando ${fileName(s)}…`);
  };

  const saveAll = () => {
    downloadZip(stems.map((s) => s.path), `${baseName}${suffix}`, format, range);
    setMsg(`Baixando ${stems.length} pistas${range ? " (só o trecho selecionado)" : ""} em um arquivo zip…`);
  };

  return (
    <div className="tab-body">
      <div className="panel">
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
              ? "Pista inteira"
              : `Trecho ${formatTime(selection.start)} → ${formatTime(selection.end)} (${formatTime(selection.end - selection.start)})`}
            {!isFull && (
              <button className="link" onClick={() => setSelection({ start: 0, end: total })}>selecionar tudo</button>
            )}
          </span>
          <FormatSelect formats={formats} value={format} onChange={setFormat} />
          <button className="btn ghost" onClick={saveAll}>
            {isFull ? "Baixar todas (zip)" : "Baixar trecho de todas (zip)"}
          </button>
        </Transport>
        <p className="hint">
          Arraste em uma waveform para selecionar um trecho: a reprodução e os downloads (⬇ e zip) usam só ele.
          Início desta separação no original: {formatTime(offset)}. Atalhos: <kbd>Espaço</kbd> tocar/pausar · <kbd>Home</kbd> início · <kbd>←</kbd> <kbd>→</kbd> voltar/avançar 1 s (<kbd>Shift</kbd> 5 s).
        </p>
        {msg && <p className="hint">{msg}</p>}
      </div>

      <div className="stem-list">
        {stems.map((s, i) => (
          <div key={s.name} className={`stem-row stem-${s.name}`}>
            <div className="stem-head">
              <div className="stem-label">{STEM_LABELS[s.name]}</div>
              <div className="stem-btns">
                <button
                  className={`sq${mute[i] ? " on" : ""}`}
                  title="Mudo"
                  onClick={() => {
                    setMute(upd(mute, i, !mute[i]));
                    pl.player.setMuted(i, !mute[i]);
                  }}
                >M</button>
                <button
                  className={`sq${solo[i] ? " on solo" : ""}`}
                  title="Solo"
                  onClick={() => {
                    setSolo(upd(solo, i, !solo[i]));
                    pl.player.setSolo(i, !solo[i]);
                  }}
                >S</button>
                <button className="sq" title={`Baixar ${isFull ? "" : "trecho em "}${extOf(format).toUpperCase()}`} onClick={() => saveOne(s)}><DownloadIcon /></button>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={vol[i]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVol(upd(vol, i, v));
                  pl.player.setVolume(i, v);
                }}
                aria-label={`Volume ${s.name}`}
              />
            </div>
            <Waveform
              buffer={s.buffer}
              color={`var(--c-${s.name})`}
              height={72}
              time={pl.time}
              onSeek={pl.seek}
              selection={selection}
              onSelect={(r) => setSelection(r ?? { start: 0, end: total })}
              tags={i === 0}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
