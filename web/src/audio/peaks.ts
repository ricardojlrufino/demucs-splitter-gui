/** Min/max peak pairs per column across all channels, cached per width. */
const cache = new WeakMap<AudioBuffer, Map<number, Float32Array>>();

export function computePeaks(buffer: AudioBuffer, columns: number): Float32Array {
  let byWidth = cache.get(buffer);
  if (!byWidth) cache.set(buffer, (byWidth = new Map()));
  const hit = byWidth.get(columns);
  if (hit) return hit;

  const peaks = new Float32Array(columns * 2);
  const n = buffer.length;
  const per = n / columns;
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  for (let x = 0; x < columns; x++) {
    const s = Math.floor(x * per);
    const e = Math.max(s + 1, Math.floor((x + 1) * per));
    const step = Math.max(1, Math.floor((e - s) / 64));
    let min = 0;
    let max = 0;
    for (const d of chans) {
      for (let i = s; i < e; i += step) {
        const v = d[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    peaks[x * 2] = min;
    peaks[x * 2 + 1] = max;
  }
  byWidth.set(columns, peaks);
  return peaks;
}
