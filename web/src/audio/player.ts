/**
 * Minimal multi-track Web Audio player. All tracks share one timeline; each
 * has its own gain (volume / mute / solo). Optional play range + looping.
 */
export interface Range {
  start: number;
  end: number;
}

export class MultiPlayer {
  readonly ctx: AudioContext;
  private buffers: AudioBuffer[] = [];
  private gains: GainNode[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private volume: number[] = [];
  private muted: boolean[] = [];
  private solo: boolean[] = [];
  private startCtxTime = 0;
  private startOffset = 0;
  private _playing = false;
  private _pos = 0;
  range: Range | null = null;
  loop = false;
  duration = 0;
  onStop?: () => void;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  setTracks(buffers: AudioBuffer[]) {
    this.stopSources();
    this.gains.forEach((g) => g.disconnect());
    this.buffers = buffers;
    this.gains = buffers.map(() => {
      const g = this.ctx.createGain();
      g.connect(this.ctx.destination);
      return g;
    });
    this.volume = buffers.map(() => 1);
    this.muted = buffers.map(() => false);
    this.solo = buffers.map(() => false);
    this.duration = Math.max(0, ...buffers.map((b) => b.duration));
    this._pos = 0;
    this._playing = false;
  }

  get playing() {
    return this._playing;
  }

  /** Current position in seconds; also handles range end / looping. */
  get time(): number {
    if (!this._playing) return this._pos;
    const t = this.startOffset + (this.ctx.currentTime - this.startCtxTime);
    const end = this.range?.end ?? this.duration;
    if (t >= end) {
      if (this.loop) {
        this.playFrom(this.range?.start ?? 0);
        return this.range?.start ?? 0;
      }
      this.pause();
      this._pos = this.range?.start ?? 0;
      this.onStop?.();
      return this._pos;
    }
    return t;
  }

  private stopSources() {
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    this.sources = [];
  }

  private playFrom(offset: number) {
    this.stopSources();
    this.startOffset = offset;
    this.startCtxTime = this.ctx.currentTime;
    this.sources = this.buffers.map((buf, i) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.gains[i]);
      src.start(0, Math.min(offset, buf.duration));
      return src;
    });
    this._playing = true;
  }

  async play() {
    if (!this.buffers.length) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    let from = this._pos;
    if (this.range && (from < this.range.start || from >= this.range.end)) from = this.range.start;
    if (from >= this.duration) from = 0;
    this.playFrom(from);
  }

  pause() {
    if (!this._playing) return;
    this._pos = this.startOffset + (this.ctx.currentTime - this.startCtxTime);
    this._playing = false;
    this.stopSources();
  }

  stop() {
    this.pause();
    this._pos = this.range?.start ?? 0;
  }

  seek(t: number) {
    t = Math.max(0, Math.min(this.duration, t));
    if (this._playing) this.playFrom(t);
    else this._pos = t;
  }

  private applyGains() {
    const anySolo = this.solo.some(Boolean);
    this.gains.forEach((g, i) => {
      const audible = anySolo ? this.solo[i] : !this.muted[i];
      g.gain.value = audible ? this.volume[i] : 0;
    });
  }

  setVolume(i: number, v: number) {
    this.volume[i] = v;
    this.applyGains();
  }
  setMuted(i: number, m: boolean) {
    this.muted[i] = m;
    this.applyGains();
  }
  setSolo(i: number, s: boolean) {
    this.solo[i] = s;
    this.applyGains();
  }

  dispose() {
    this.stopSources();
    this.gains.forEach((g) => g.disconnect());
  }
}
