import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OriginalTab } from "./components/OriginalTab";
import { StemsTab, type StemResult } from "./components/StemsTab";
import type { Range } from "./audio/player";
import { MODELS, type Device, type StemId } from "./lib/models";
import {
  cancelSeparation,
  checkEnvironment,
  loadAudio,
  loadSetting,
  saveSetting,
  separate,
  uploadAudio,
  type Environment,
} from "./lib/backend";

type Tab = "original" | "stems";
type Busy = { phase: "download" | "separate"; progress: number; elapsed: number; status: string };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App() {
  const ctx = useMemo(() => new AudioContext(), []);

  const [env, setEnv] = useState<Environment | null>(null);
  const [demucsPath, setDemucsPath] = useState(() => loadSetting("demucsPath", ""));
  const [device, setDevice] = useState<Device>(() => loadSetting("device", "auto") as Device);

  const [file, setFile] = useState<{ id: string; name: string; buffer: AudioBuffer } | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Range>({ start: 0, end: 0 });

  const [modelId, setModelId] = useState("htdemucs_6s");
  const [stems, setStems] = useState<StemId[]>([...MODELS[1].stems]);
  const [tab, setTab] = useState<Tab>("original");
  const [busy, setBusy] = useState<Busy | null>(null);
  const [sepError, setSepError] = useState<string | null>(null);
  const [result, setResult] = useState<{ stems: StemResult[]; offset: number; baseName: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const recheck = useCallback(
    (path: string) => {
      setEnv(null);
      checkEnvironment(path.trim() || null).then(setEnv);
    },
    [],
  );

  useEffect(() => recheck(demucsPath), []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeModel = (id: string) => {
    setModelId(id);
    setStems([...MODELS.find((m) => m.id === id)!.stems]);
  };

  const openFile = useCallback(
    async (f: File) => {
      setLoadingFile(true);
      setFileError(null);
      try {
        const up = await uploadAudio(f);
        const buffer = await loadAudio(ctx, up.wav);
        setFile({ id: up.id, name: up.name, buffer });
        setSelection({ start: 0, end: buffer.duration });
        setResult(null);
        setSepError(null);
        setTab("original");
      } catch (e) {
        setFileError(errMsg(e));
      } finally {
        setLoadingFile(false);
      }
    },
    [ctx],
  );

  const fileInput = useRef<HTMLInputElement>(null);
  const jobRef = useRef<string | null>(null);

  const runSeparation = useCallback(async () => {
    if (!file) return;
    setSepError(null);
    const t0 = performance.now();
    setBusy({ phase: "separate", progress: 0, elapsed: 0, status: "" });
    const timer = setInterval(
      () => setBusy((b) => (b ? { ...b, elapsed: (performance.now() - t0) / 1000 } : b)),
      500,
    );
    try {
      const full = selection.start <= 0.001 && selection.end >= file.buffer.duration - 0.001;
      const files = await separate(
        {
          id: file.id,
          start: full ? null : selection.start,
          end: full ? null : selection.end,
          model: modelId,
          device,
          demucs: demucsPath.trim() || null,
        },
        {
          onProgress: (p) => setBusy((b) => (b ? { ...b, phase: p.phase, progress: p.percent } : b)),
          onStatus: (text) => setBusy((b) => (b ? { ...b, status: text } : b)),
        },
        (id) => (jobRef.current = id),
      );
      const wanted = files.filter((s) => stems.includes(s.name as StemId));
      const loaded: StemResult[] = await Promise.all(
        wanted.map(async (s) => ({ name: s.name as StemId, path: s.url, buffer: await loadAudio(ctx, s.url) })),
      );
      setResult({ stems: loaded, offset: full ? 0 : selection.start, baseName: file.name.replace(/\.[^.]+$/, "") });
      setTab("stems");
    } catch (e) {
      setSepError(errMsg(e));
    } finally {
      clearInterval(timer);
      jobRef.current = null;
      setBusy(null);
    }
  }, [file, selection, modelId, device, demucsPath, stems, ctx]);

  const originalBuffers = useMemo(() => (file ? [file.buffer] : []), [file]);

  return (
    <div className="app">
      <header>
        <h1>Stem Splitter</h1>
        <p className="muted">Separação de áudio em até 6 pistas usando o Demucs instalado no computador</p>
      </header>

      {!file ? (
        <>
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
              accept="audio/*,video/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus,.wma"
              hidden
              onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])}
            />
            <div className="drop-title">{loadingFile ? "Preparando áudio…" : "Solte um arquivo de áudio aqui"}</div>
            <div className="muted">ou clique para escolher (MP3, WAV, FLAC, OGG, M4A…)</div>
            {fileError && <div className="alert pre">{fileError}</div>}
          </div>
        </>
      ) : (
        <>
          <nav className="tabs">
            <button className={tab === "original" ? "active" : ""} onClick={() => setTab("original")}>
              1 · Original
            </button>
            <button className={tab === "stems" ? "active" : ""} disabled={!result} onClick={() => setTab("stems")}>
              2 · Pistas {result ? `(${result.stems.length})` : ""}
            </button>
          </nav>

          {tab === "original" || !result ? (
            <OriginalTab
              ctx={ctx}
              fileName={file.name}
              buffer={file.buffer}
              buffers={originalBuffers}
              selection={selection}
              onSelect={(r) => setSelection(r ?? { start: 0, end: file.buffer.duration })}
              modelId={modelId}
              onModelChange={changeModel}
              stems={stems}
              onStemsChange={setStems}
              env={env}
              device={device}
              onDeviceChange={(d) => {
                setDevice(d);
                saveSetting("device", d);
              }}
              demucsPath={demucsPath}
              onDemucsPathChange={(p) => {
                setDemucsPath(p);
                saveSetting("demucsPath", p);
              }}
              onRecheck={() => recheck(demucsPath)}
              busy={busy}
              error={sepError}
              onSeparate={runSeparation}
              onCancel={() => jobRef.current && cancelSeparation(jobRef.current)}
              onNewFile={() => {
                setFile(null);
                setResult(null);
              }}
            />
          ) : (
            <StemsTab ctx={ctx} baseName={result.baseName} stems={result.stems} offset={result.offset} />
          )}
        </>
      )}
    </div>
  );
}
