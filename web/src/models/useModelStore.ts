import { useCallback, useEffect, useRef, useState } from "react";
import { cacheModel, isCached } from "./modelCache";
import type { ModelVariant } from "./registry";
import type { DemucsWorker } from "../hooks/useDemucsWorker";

export type DownloadState =
  | { status: "checking" }
  | { status: "not-downloaded" }
  | { status: "downloading"; progress: number | null }
  | { status: "cached" }
  | { status: "error"; message: string };

/** Tracks download/cache state of every model variant and exposes `start(id)`. */
export function useModelStore(models: readonly ModelVariant[], worker: DemucsWorker) {
  const [states, setStates] = useState<Record<string, DownloadState>>({});
  const aborts = useRef(new Map<string, AbortController>());

  const set = useCallback((id: string, s: DownloadState) => {
    setStates((prev) => ({ ...prev, [id]: s }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    for (const m of models) {
      isCached(m.id)
        .then((c) => !cancelled && set(m.id, c ? { status: "cached" } : { status: "not-downloaded" }))
        .catch(() => !cancelled && set(m.id, { status: "not-downloaded" }));
    }
    return () => {
      cancelled = true;
      aborts.current.forEach((a) => a.abort());
    };
  }, [models, set]);

  const start = useCallback(
    async (id: string) => {
      const variant = models.find((m) => m.id === id);
      if (!variant || aborts.current.has(id)) return;
      const controller = new AbortController();
      aborts.current.set(id, controller);
      set(id, { status: "downloading", progress: 0 });
      try {
        const res = await fetch(variant.downloadUrl, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const total = parseInt(res.headers.get("content-length") ?? "", 10) || null;
        const reader = res.body!.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          set(id, { status: "downloading", progress: total ? received / total : null });
        }
        const buf = new Uint8Array(received);
        let offset = 0;
        for (const c of chunks) {
          buf.set(c, offset);
          offset += c.length;
        }
        const { result } = await worker.validate(buf.slice(), id);
        if (!result.valid) throw new Error(`Pesos inválidos: ${result.error}`);
        await cacheModel(id, buf.buffer);
        set(id, { status: "cached" });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        set(id, { status: "error", message: err instanceof Error ? err.message : "Falha no download" });
      } finally {
        aborts.current.delete(id);
      }
    },
    [models, set, worker],
  );

  return { states, start };
}
