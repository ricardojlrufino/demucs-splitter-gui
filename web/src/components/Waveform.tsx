import { useCallback, useEffect, useRef, useState } from "react";
import { computePeaks } from "../audio/peaks";
import type { Range } from "../audio/player";
import { formatTime } from "../dsp/wav";

interface Props {
  buffer: AudioBuffer;
  color: string;
  height?: number;
  time: number;
  onSeek: (t: number) => void;
  /** When provided, the user can drag on the waveform to select a range. */
  selection?: Range | null;
  onSelect?: (r: Range | null) => void;
}

const EDGE_PX = 8;
const EDGE_PX_TOUCH = 16;
const MIN_TAG_PX = 130; // abaixo disso as etiquetas de tempo das alças se sobrepõem
const MIN_SEL = 0.5;

export function Waveform({ buffer, color, height = 120, time, onSeek, selection, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  type Mode = "new" | "start" | "end" | "move";
  const drag = useRef<{ mode: Mode; anchor: number; x0: number; moved: boolean; sel: Range | null } | null>(null);
  const [hover, setHover] = useState<Mode>("new");
  const [active, setActive] = useState<Mode | null>(null);
  const duration = buffer.duration;

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth)));
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const g = canvas.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);

    const style = getComputedStyle(canvas);
    const mid = height / 2;
    const peaks = computePeaks(buffer, Math.max(1, Math.floor(width * dpr)));
    const cols = peaks.length / 2;

    const m = /^var\((--[\w-]+)\)$/.exec(color);
    g.fillStyle = m ? style.getPropertyValue(m[1]).trim() || "#888" : color;
    for (let i = 0; i < cols; i++) {
      const x = i / dpr;
      const y1 = mid - peaks[i * 2 + 1] * mid * 0.95;
      const y2 = mid - peaks[i * 2] * mid * 0.95;
      g.fillRect(x, y1, 1 / dpr + 0.3, Math.max(1, y2 - y1));
    }

    if (selection) {
      const x1 = (selection.start / duration) * width;
      const x2 = (selection.end / duration) * width;
      g.fillStyle = style.getPropertyValue("--sel-dim") || "rgba(0,0,0,.5)";
      g.fillRect(0, 0, x1, height);
      g.fillRect(x2, 0, width - x2, height);
    }

    const px = (time / duration) * width;
    g.fillStyle = style.getPropertyValue("--playhead") || "#fff";
    g.fillRect(px - 0.5, 0, 1.5, height);
  }, [buffer, color, height, width, time, selection, duration]);

  const toTime = useCallback(
    (clientX: number) => {
      const rect = wrapRef.current!.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return f * duration;
    },
    [duration],
  );

  const hitTest = (clientX: number): Mode => {
    if (!onSelect || !selection) return "new";
    const rect = wrapRef.current!.getBoundingClientRect();
    const sx = rect.left + (selection.start / duration) * rect.width;
    const ex = rect.left + (selection.end / duration) * rect.width;
    const edge = window.matchMedia("(pointer: coarse)").matches ? EDGE_PX_TOUCH : EDGE_PX;
    const ds = Math.abs(clientX - sx);
    const de = Math.abs(clientX - ex);
    if (ds <= edge && ds <= de) return "start";
    if (de <= edge) return "end";
    if (clientX > sx && clientX < ex) return "move";
    return "new";
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const t = toTime(e.clientX);
    const mode = hitTest(e.clientX);
    const anchor = mode === "start" ? selection!.end : mode === "end" ? selection!.start : t;
    drag.current = { mode, anchor, x0: e.clientX, moved: false, sel: selection ?? null };
    setActive(mode);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) {
      if (onSelect) setHover(hitTest(e.clientX));
      return;
    }
    if (!onSelect) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) < 4) return;
    d.moved = true;
    const t = toTime(e.clientX);
    if (d.mode === "move" && d.sel) {
      const len = d.sel.end - d.sel.start;
      const dt = t - toTime(d.x0);
      const start = Math.min(duration - len, Math.max(0, d.sel.start + dt));
      onSelect({ start, end: start + len });
    } else {
      onSelect({ start: Math.min(d.anchor, t), end: Math.max(d.anchor, t) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setActive(null);
    if (!d) return;
    if (!d.moved) {
      onSeek(toTime(e.clientX));
    } else if (onSelect && selection && selection.end - selection.start < MIN_SEL) {
      onSelect(null);
    }
  };

  const mode = active ?? hover;
  const cursor =
    !onSelect ? "pointer"
    : mode === "start" || mode === "end" ? "ew-resize"
    : mode === "move" ? (active === "move" ? "grabbing" : "grab")
    : "crosshair";
  const pct = (t: number) => `${(t / duration) * 100}%`;
  const showTags = selection ? ((selection.end - selection.start) / duration) * width >= MIN_TAG_PX : false;

  return (
    <div
      ref={wrapRef}
      className="waveform"
      style={{ height, cursor }}
      onPointerLeave={() => !drag.current && setHover("new")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height }} />
      {selection && onSelect && (
        <>
          <div
            className="sel-body"
            style={{ left: pct(selection.start), width: pct(selection.end - selection.start) }}
          />
          <div
            className={`handle start${mode === "start" ? " hot" : ""}`}
            style={{ left: pct(selection.start) }}
          >
            <span className="grip"></span>
            {showTags && <span className="tag mono">{formatTime(selection.start)}</span>}
          </div>
          <div
            className={`handle end${mode === "end" ? " hot" : ""}`}
            style={{ left: pct(selection.end) }}
          >
            <span className="grip"></span>
            {showTags && <span className="tag mono">{formatTime(selection.end)}</span>}
          </div>
        </>
      )}
    </div>
  );
}
