import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import wasmUrl from "./wasm/demucs_wasm_bg.wasm?url";
import { useDemucsWorker } from "./hooks/useDemucsWorker";
import { initRegistry, type ModelVariant, type StemId } from "./models/registry";
import { useModelStore } from "./models/useModelStore";
import { loadModel } from "./models/modelCache";
import { OriginalTab } from "./components/OriginalTab";
import { StemsTab, type StemResult } from "./components/StemsTab";
import type { Range } from "./audio/player";
import { detectWebGpu, type GpuStatus } from "./audio/webgpu";

type Tab = "original" | "stems";

export function App() {
  const worker = useDemucsWorker();
  const ctx = useMemo(() => new AudioContext(), []);
  const [models, setModels] = useState<readonly ModelVariant[]>([]);
  const [initError, setInitError] = useState<string | null>(null);

  const [file, setFile] = useState<{ name: string; buffer: AudioBuffer } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Range>({ start: 0, end: 0 });

  const [modelId, setModelId] = useState("htdemucs_6s");
  const [stems, setStems] = useState<StemId[]>([]);
  const [tab, setTab] = useState<Tab>("original");
  const [busy, setBusy] = useState<{ progress: number; elapsed: number } | null>(null);
  const [sepError, setSepError] = useState<string | null>(null);
  const [result, setResult] = useState<{ stems: StemResult[]; offset: number; baseName: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [gpu, setGpu] = useState<GpuStatus>("checking");

  useEffect(() => {
    detectWebGpu().then(setGpu);
  }, []);

  useEffect(() => {
    worker
      .init(wasmUrl)
      .then(({ registry }) => {
        initRegistry(registry);
        setModels(
          registry.map((m: any) => ({
            id: m.id,
            label: m.label,
            description: m.description,
            sizeMb: m.size_mb,
            stems: m.stems,
            filename: m.filename,
            downloadUrl: m.download_url,
          })),
        );
      })
      .catch((e: Error) => setInitError(e.message));
  }, [worker]);

  const { states, start } = useModelStore(models, worker);

  // Default stem selection follows the chosen model
  const currentModel = models.find((m) => m.id === modelId);
  useEffect(() => {
    if (currentModel) setStems([...currentModel.stems]);
  }, [currentModel]);

  const originalBuffers = useMemo(() => (file ? [file.buffer] : []), [file]);

  const openFile = useCallback(
    async (f: File) => {
      setLoadingFile(true);
      setFileError(null);
      try {
        const buffer = await ctx.decodeAudioData(await f.arrayBuffer());
        setFile({ name: f.name, buffer });
        setSelection({ start: 0, end: buffer.duration });
        setResult(null);
        setTab("original");
      } catch {
        setFileError("Não foi possível decodificar este arquivo de áudio.");
      } finally {
        setLoadingFile(false);
      }
    },
    [ctx],
  );

  const separate = useCallback(async () => {
    if (!file) return;
    setSepError(null);
    const t0 = performance.now();
    setBusy({ progress: 0, elapsed: 0 });
    const timer = setInterval(
      () => setBusy((b) => (b ? { ...b, elapsed: (performance.now() - t0) / 1000 } : b)),
      500,
    );
    try {
      const buf = file.buffer;
      const sr = buf.sampleRate;
      const s0 = selection ? Math.floor(selection.start * sr) : 0;
      const s1 = selection ? Math.min(buf.length, Math.ceil(selection.end * sr)) : buf.length;
      const left = buf.getChannelData(0).slice(s0, s1);
      const right = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).slice(s0, s1);

      const bytes = await loadModel(modelId);
      if (!bytes) throw new Error("Modelo não encontrado no cache. Baixe-o novamente.");

      const res = await worker.separate(
        { modelBytes: new Uint8Array(bytes), modelId, stems, left, right, sampleRate: sr },
        (ev) => {
          if (ev.type === "chunk_done") setBusy((b) => (b ? { ...b, progress: (ev.index + 1) / ev.total } : b));
        },
      );

      const n = res.nSamples;
      const out: StemResult[] = res.stemNames.map((name, i) => {
        const ab = ctx.createBuffer(2, n, sr);
        ab.copyToChannel(res.audio.subarray(i * 2 * n, i * 2 * n + n), 0);
        ab.copyToChannel(res.audio.subarray(i * 2 * n + n, (i + 1) * 2 * n), 1);
        return { name: name as StemId, buffer: ab };
      });
      setResult({
        stems: out,
        offset: s0 / sr,
        baseName: file.name.replace(/\.[^.]+$/, ""),
      });
      setTab("stems");
    } catch (e) {
      setSepError(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(timer);
      setBusy(null);
    }
  }, [file, selection, modelId, stems, worker, ctx]);

  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="app">
      <header>
        <h1>Stem Splitter</h1>
        <p className="muted">Separação de áudio em até 6 pistas, 100% no seu navegador (WebGPU)</p>
      </header>

      {initError && <div className="alert">Falha ao iniciar o motor WASM: {initError}</div>}

      {!file ? (
        <div
          className={`dropzone${dragOver ? " over" : ""}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) openFile(f);
          }}
        >
          <input
            ref={fileInput}
            type="file"
            accept="audio/*,video/mp4"
            hidden
            onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])}
          />
          <div className="drop-title">{loadingFile ? "Carregando…" : "Solte um arquivo de áudio aqui"}</div>
          <div className="muted">ou clique para escolher (MP3, WAV, FLAC, OGG, M4A…)</div>
          {fileError && <div className="alert">{fileError}</div>}
        </div>
      ) : (
        <>
          <nav className="tabs">
            <button className={tab === "original" ? "active" : ""} onClick={() => setTab("original")}>
              1 · Original
            </button>
            <button
              className={tab === "stems" ? "active" : ""}
              disabled={!result}
              onClick={() => setTab("stems")}
            >
              2 · Pistas {result ? `(${result.stems.length})` : ""}
            </button>
          </nav>

          {tab === "original" || !result ? (
            models.length > 0 && (
              <OriginalTab
                ctx={ctx}
                fileName={file.name}
                buffer={file.buffer}
                buffers={originalBuffers}
                selection={selection}
                onSelect={(r) => setSelection(r ?? { start: 0, end: file.buffer.duration })}
                models={models}
                states={states}
                modelId={modelId}
                onModelChange={setModelId}
                onDownload={start}
                stems={stems}
                onStemsChange={setStems}
                busy={busy}
                error={sepError}
                onSeparate={separate}
                onNewFile={() => {
                  setFile(null);
                  setResult(null);
                }}
                gpu={gpu}
              />
            )
          ) : (
            <StemsTab ctx={ctx} baseName={result.baseName} stems={result.stems} offset={result.offset} />
          )}
        </>
      )}
    </div>
  );
}
