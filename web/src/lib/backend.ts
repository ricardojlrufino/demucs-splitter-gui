import type { Device } from "./models";

/** Configuração da execução, escrita pelo launcher em config.js (porta da API e token de acesso). */
declare global {
  interface Window {
    __STEM_API__?: { base: string; token: string };
  }
}

const api = window.__STEM_API__;

function url(path: string, params: Record<string, string> = {}): string {
  if (!api) throw new Error("Esta interface precisa ser aberta pelo aplicativo Demucs Splitter GUI.");
  const q = new URLSearchParams({ ...params, t: api.token });
  return `${api.base}${path}?${q}`;
}

/** URL absoluta de um arquivo servido pela API (`/media/...`). */
export const mediaUrl = (path: string, params: Record<string, string> = {}) => url(path, params);

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Erro HTTP ${res.status}`);
  return body as T;
}

export interface Environment {
  demucs: string | null;
  ffmpeg: string | null;
  torch: string | null;
  cuda: boolean | null;
  mps: boolean | null;
  /** Formatos de exportação disponíveis, do melhor para o mais compatível (ex.: ["ogg","mp3","wav"]). */
  formats: string[];
}

export interface StemFile {
  name: string;
  url: string;
}

export interface Progress {
  phase: "download" | "separate";
  percent: number;
}

export interface SeparateRequest {
  id: string;
  start: number | null;
  end: number | null;
  model: string;
  device: Device;
  demucs: string | null;
}

export const checkEnvironment = (demucs: string | null) =>
  fetch(url("/api/env", demucs ? { demucs } : {})).then((r) => json<Environment>(r));

/** Envia o arquivo (o servidor converte para WAV) e devolve o id e a URL do WAV. */
export const uploadAudio = (file: File) =>
  fetch(url("/api/upload"), {
    method: "POST",
    headers: { "X-Filename": encodeURIComponent(file.name) },
    body: file,
  }).then((r) => json<{ id: string; name: string; wav: string }>(r));

export async function loadAudio(ctx: AudioContext, path: string): Promise<AudioBuffer> {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error("Falha ao carregar o áudio.");
  return ctx.decodeAudioData(await res.arrayBuffer());
}

export interface Handlers {
  onProgress: (p: Progress) => void;
  onStatus: (text: string) => void;
}

/** Acompanha uma tarefa do servidor (SSE) até o fim e devolve o resultado do evento "done". */
function followJob<T>(job: string, h: Handlers): Promise<T> {
  return new Promise((resolve, reject) => {
    const es = new EventSource(url("/api/events", { job }));
    es.addEventListener("progress", (e) => h.onProgress(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("status", (e) => h.onStatus(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("done", (e) => {
      es.close();
      resolve(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      es.close();
      reject(new Error(data ? JSON.parse(data) : "Conexão com o aplicativo perdida."));
    });
  });
}

const postJob = (path: string, body: unknown) =>
  fetch(url(path), { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) }).then((r) =>
    json<{ job: string }>(r),
  );

/** Inicia a separação e acompanha o progresso até o fim. */
export async function separate(
  req: SeparateRequest,
  h: Handlers,
  onJob: (jobId: string) => void,
): Promise<StemFile[]> {
  const { job } = await postJob("/api/separate", req);
  onJob(job);
  return (await followJob<{ stems: StemFile[] }>(job, h)).stems;
}

/** Baixa o áudio de um vídeo do YouTube (feito pelo app) e devolve o id e a URL do WAV, como no upload. */
export async function importYoutube(
  link: string,
  h: Handlers,
  onJob: (jobId: string) => void,
): Promise<{ id: string; name: string; wav: string }> {
  const { job } = await postJob("/api/youtube", { url: link });
  onJob(job);
  return followJob(job, h);
}

export const cancelSeparation = (job: string) =>
  fetch(url("/api/cancel"), { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ job }) });

/** Dispara o download de um arquivo pelo navegador. */
function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const downloadStem = (path: string, fileName: string, format: string) =>
  triggerDownload(url(path, { download: fileName, format }));

export const downloadZip = (paths: string[], baseName: string, format: string) =>
  triggerDownload(url("/api/zip", { urls: paths.join(","), base: baseName, format }));

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const loadSetting = (key: string, fallback: string) =>
  safe(() => localStorage.getItem(`demucs-splitter-gui:${key}`) ?? fallback, fallback);
export const saveSetting = (key: string, value: string) =>
  safe(() => localStorage.setItem(`demucs-splitter-gui:${key}`, value), undefined);
