import { formatTime } from "../dsp/wav";
import { BackIcon, ForwardIcon, LoopIcon, PauseIcon, PlayIcon, StopIcon } from "./Icons";

interface Props {
  playing: boolean;
  time: number;
  duration: number;
  loop: boolean;
  onToggle: () => void;
  onStop: () => void;
  onSkip: (delta: number) => void;
  onLoop: (v: boolean) => void;
  children?: React.ReactNode;
}

export function Transport({ playing, time, duration, loop, onToggle, onStop, onSkip, onLoop, children }: Props) {
  return (
    <div className="transport">
      <button className="icon-btn" title="Voltar 5s" onClick={() => onSkip(-5)}><BackIcon /></button>
      <button className="icon-btn primary" title={playing ? "Pausar" : "Tocar"} onClick={onToggle}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button className="icon-btn" title="Parar" onClick={onStop}><StopIcon /></button>
      <button className="icon-btn" title="Avançar 5s" onClick={() => onSkip(5)}><ForwardIcon /></button>
      <button className={`icon-btn${loop ? " active" : ""}`} title="Repetir" onClick={() => onLoop(!loop)}><LoopIcon /></button>
      <span className="time mono">
        {formatTime(time)} / {formatTime(duration)}
      </span>
      <div className="spacer" />
      {children}
    </div>
  );
}
