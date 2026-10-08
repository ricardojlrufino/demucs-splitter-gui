import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OriginalTab } from "./components/OriginalTab";
import { StemsTab, type StemResult } from "./components/StemsTab";
import type { Range } from "./audio/player";
import type { Device, StemId } from "./lib/models";
import {
  cancelSeparation,
  checkEnvironment,
  importYoutube,
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

  const acceptUpload = useCallback(
    async (up: { id: string; name: string; wav: string }) => {
      const buffer = await loadAudio(ctx, up.wav);
      setFile({ id: up.id, name: up.name, buffer });
      setSelection({ start: 0, end: buffer.duration });
      setResult(null);
      setSepError(null);
      setTab("original");
    },
    [ctx],
  );

  const openFile = useCallback(
    async (f: File) => {
      setLoadingFile(true);
      setFileError(null);
      try {
        await acceptUpload(await uploadAudio(f));
      } catch (e) {
        setFileError(errMsg(e));
      } finally {
        setLoadingFile(false);
      }
    },
    [acceptUpload],
  );

  const [ytUrl, setYtUrl] = useState("");
  const [yt, setYt] = useState<{ percent: number; status: string } | null>(null);
  const ytJob = useRef<string | null>(null);

  const openYoutube = useCallback(async () => {
    if (!ytUrl.trim() || yt) return;
    setFileError(null);
    setYt({ percent: 0, status: "Conectando…" });
    try {
      const up = await importYoutube(
        ytUrl,
        {
          onProgress: (p) => setYt((y) => (y ? { ...y, percent: p.percent } : y)),
          onStatus: (status) => setYt((y) => (y ? { ...y, status } : y)),
        },
        (id) => (ytJob.current = id),
      );
      await acceptUpload(up);
      setYtUrl("");
    } catch (e) {
      setFileError(errMsg(e));
    } finally {
      ytJob.current = null;
      setYt(null);
    }
  }, [ytUrl, yt, acceptUpload]);

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
      const loaded: StemResult[] = await Promise.all(
        files.map(async (s) => ({ name: s.name as StemId, path: s.url, buffer: await loadAudio(ctx, s.url) })),
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
  }, [file, selection, modelId, device, demucsPath, ctx]);

  const originalBuffers = useMemo(() => (file ? [file.buffer] : []), [file]);

  return (
    <div className="app">
      <header>
        <h1>Demucs Splitter GUI</h1>
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
          </div>

          <div className="yt-row">
            <input
              type="url"
              placeholder="Ou cole um link do YouTube"
              value={ytUrl}
              disabled={!!yt}
              onChange={(e) => setYtUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && openYoutube()}
              aria-label="Link do YouTube"
            />
            {yt ? (
              <button className="btn ghost" onClick={() => ytJob.current && cancelSeparation(ytJob.current)}>Cancelar</button>
            ) : (
              <button className="btn primary" disabled={!ytUrl.trim()} onClick={openYoutube}>Importar</button>
            )}
          </div>
          {yt && (
            <div className="yt-progress">
              <div className="bar big"><div style={{ width: `${yt.percent}%` }} /></div>
              <span className="mono muted">{yt.status} {yt.percent > 0 && yt.percent < 100 ? `${Math.round(yt.percent)}%` : ""}</span>
            </div>
          )}
          {fileError && <div className="alert pre">{fileError}</div>}
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
              onModelChange={setModelId}
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
            <StemsTab
              ctx={ctx}
              baseName={result.baseName}
              stems={result.stems}
              offset={result.offset}
              formats={env?.formats?.length ? env.formats : ["wav"]}
            />
          )}
        </>
      )}
    </div>
  );
}
