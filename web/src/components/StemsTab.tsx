import { useMemo, useState } from "react";
import { Waveform } from "./Waveform";
import { Transport } from "./Transport";
import { usePlayer } from "../hooks/usePlayer";
import { encodeWavUrl, formatTime } from "../dsp/wav";
import { DownloadIcon } from "./Icons";
import { ALL_STEM_LABELS } from "./OriginalTab";
import type { StemId } from "../models/registry";

export interface StemResult {
  name: StemId;
  buffer: AudioBuffer;
}

interface Props {
  ctx: AudioContext;
  baseName: string;
  stems: StemResult[];
  offset: number;
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

function saveStem(s: StemResult, baseName: string) {
  const url = encodeWavUrl(s.buffer.getChannelData(0), s.buffer.getChannelData(1), s.buffer.sampleRate);
  download(url, `${baseName} - ${s.name}.wav`);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function StemsTab({ ctx, baseName, stems, offset }: Props) {
  const buffers = useMemo(() => stems.map((s) => s.buffer), [stems]);
  const pl = usePlayer(ctx, buffers, null);
  const [vol, setVol] = useState<number[]>(() => stems.map(() => 1));
  const [mute, setMute] = useState<boolean[]>(() => stems.map(() => false));
  const [solo, setSolo] = useState<boolean[]>(() => stems.map(() => false));

  const upd = <T,>(arr: T[], i: number, v: T) => arr.map((x, j) => (j === i ? v : x));

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
          <button
            className="btn ghost"
            onClick={() => stems.forEach((s, i) => setTimeout(() => saveStem(s, baseName), i * 300))}
          >
            Baixar todas (WAV)
          </button>
        </Transport>
      </div>

      <div className="stem-list">
        {stems.map((s, i) => (
          <div key={s.name} className={`stem-row stem-${s.name}`}>
            <div className="stem-head">
              <div className="stem-label">{ALL_STEM_LABELS[s.name]}</div>
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
                <button className="sq" title="Baixar WAV" onClick={() => saveStem(s, baseName)}><DownloadIcon /></button>
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
