import { useMemo, useState } from "react";
import { Waveform } from "./Waveform";
import { Transport } from "./Transport";
import { DownloadIcon } from "./Icons";
import { usePlayer } from "../hooks/usePlayer";
import { formatTime } from "../dsp/wav";
import { STEM_LABELS, type StemId } from "../lib/models";
import { downloadStem, downloadZip } from "../lib/backend";

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
}

export function StemsTab({ ctx, baseName, stems, offset }: Props) {
  const buffers = useMemo(() => stems.map((s) => s.buffer), [stems]);
  const pl = usePlayer(ctx, buffers, null);
  const [vol, setVol] = useState<number[]>(() => stems.map(() => 1));
  const [mute, setMute] = useState<boolean[]>(() => stems.map(() => false));
  const [solo, setSolo] = useState<boolean[]>(() => stems.map(() => false));
  const [msg, setMsg] = useState<string | null>(null);

  const upd = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x));
  const fileName = (s: StemResult) => `${baseName} - ${s.name}.wav`;

  const saveOne = (s: StemResult) => {
    downloadStem(s.path, fileName(s));
    setMsg(`Baixando ${fileName(s)}…`);
  };

  const saveAll = () => {
    downloadZip(stems.map((s) => s.path), baseName);
    setMsg(`Baixando ${stems.length} pistas em um arquivo zip…`);
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
          <span className="muted mono">Início no original: {formatTime(offset)}</span>
          <button className="btn ghost" onClick={saveAll}>Baixar todas (zip)</button>
        </Transport>
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
                <button className="sq" title="Baixar WAV" onClick={() => saveOne(s)}><DownloadIcon /></button>
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
            <Waveform buffer={s.buffer} color={`var(--c-${s.name})`} height={72} time={pl.time} onSeek={pl.seek} />
          </div>
        ))}
      </div>
    </div>
  );
}
