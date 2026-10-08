import type { Environment } from "../lib/backend";
import type { Device } from "../lib/models";

interface Props {
  env: Environment | null;
  device: Device;
  onDeviceChange: (d: Device) => void;
  demucsPath: string;
  onDemucsPathChange: (p: string) => void;
  onRecheck: () => void;
}

const CUDA_FIX =
  "pipx runpip demucs install torch torchaudio --index-url https://download.pytorch.org/whl/cu126";

export function EnvPanel({ env, device, onDeviceChange, demucsPath, onDemucsPathChange, onRecheck }: Props) {
  if (!env) return <div className="env muted">Verificando ambiente…</div>;
  const gpuOk = env.cuda === true || env.mps === true;
  const cpuOnly = env.torch != null && !gpuOk;

  return (
    <div className="env">
      <div className="env-row">
        <span className={env.demucs ? "ok" : "bad"}>{env.demucs ? "●" : "✕"} Demucs</span>
        <span className="muted mono">{env.demucs ?? "não encontrado"}</span>
      </div>
      <div className="env-row">
        <span className={env.ffmpeg ? "ok" : "bad"}>{env.ffmpeg ? "●" : "✕"} ffmpeg</span>
        <span className="muted mono">{env.ffmpeg ?? "não encontrado — instale o ffmpeg e coloque no PATH"}</span>
      </div>
      <div className="env-row">
        <span className={gpuOk ? "ok" : env.torch ? "warn" : "muted"}>
          {gpuOk ? "●" : env.torch ? "▲" : "?"} Aceleração
        </span>
        <span className="muted mono">
          {gpuOk
            ? env.cuda
              ? `CUDA disponível (torch ${env.torch})`
              : `MPS disponível (torch ${env.torch})`
            : env.torch
              ? `somente CPU (torch ${env.torch})`
              : "não foi possível detectar"}
        </span>
        <label className="device">
          Dispositivo
          <select value={device} onChange={(e) => onDeviceChange(e.target.value as Device)}>
            <option value="auto">Automático</option>
            <option value="cuda">CUDA (NVIDIA)</option>
            <option value="mps">MPS (Apple)</option>
            <option value="cpu">CPU</option>
          </select>
        </label>
      </div>

      {cpuOnly && (
        <div className="gpu-warn">
          <strong>O PyTorch do seu Demucs não tem suporte a GPU</strong>
          <p>
            Ele vai rodar na CPU, o que é bem mais lento. Se tiver uma placa NVIDIA, reinstale o PyTorch com CUDA no
            ambiente do Demucs (instalado via pipx) e depois clique em "Verificar de novo":
          </p>
          <p className="mono">{CUDA_FIX}</p>
          <button className="link" onClick={() => navigator.clipboard?.writeText(CUDA_FIX)}>copiar comando</button>
        </div>
      )}

      <details className="env-custom" open={!env.demucs}>
        <summary>Caminho do Demucs</summary>
        <div className="env-path">
          <input
            type="text"
            placeholder="Automático (PATH). Ex.: /home/usuario/.local/bin/demucs"
            value={demucsPath}
            onChange={(e) => onDemucsPathChange(e.target.value)}
          />
          <button className="btn ghost" onClick={onRecheck}>Verificar de novo</button>
        </div>
        {!env.demucs && <p className="muted">Instale com <span className="mono">pipx install demucs</span> ou informe o caminho acima.</p>}
      </details>
    </div>
  );
}
