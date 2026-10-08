"""Localiza o Demucs instalado, detecta GPU e executa a separação acompanhando o progresso."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from typing import Callable

from .procs import IS_WINDOWS, find_ffmpeg, kill_tree, popen_kwargs, run

MODELS = ("htdemucs", "htdemucs_6s", "htdemucs_ft")
STEM_ORDER = ("drums", "bass", "other", "vocals", "guitar", "piano")


def find_demucs(custom: str | None = None) -> str | None:
    if custom and custom.strip():
        p = Path(custom.strip()).expanduser()
        return str(p) if p.exists() else None
    found = shutil.which("demucs")
    if found:
        return found
    home = Path.home()
    candidates = [home / ".local/bin/demucs", Path("/opt/homebrew/bin/demucs"), Path("/usr/local/bin/demucs")]
    appdata = os.environ.get("APPDATA")
    if appdata and (Path(appdata) / "Python").is_dir():
        candidates += list((Path(appdata) / "Python").glob("*/Scripts/demucs.exe"))
    local = os.environ.get("USERPROFILE")
    if local:
        candidates += list((Path(local) / ".local/bin").glob("demucs*"))
    return next((str(c) for c in candidates if c.exists()), None)


def python_of(demucs: str) -> str | None:
    """Interpretador Python do ambiente do Demucs (shebang no Unix; ao lado do .exe no Windows)."""
    p = Path(demucs)
    if IS_WINDOWS:
        for cand in (p.parent / "python.exe", p.parent.parent / "python.exe"):
            if cand.exists():
                return str(cand)
        return None
    try:
        first = p.read_bytes()[:256].decode("utf-8", "replace").splitlines()[0]
    except (OSError, IndexError):
        return None
    if not first.startswith("#!"):
        return None
    py = first[2:].split()[-1]
    return py if Path(py).exists() else None


def probe_torch(python: str) -> tuple[str, bool, bool] | None:
    code = (
        "import torch;print(torch.__version__);print(torch.cuda.is_available());"
        "print(bool(getattr(torch.backends,'mps',None) and torch.backends.mps.is_available()))"
    )
    r = run([python, "-c", code], env=gpu_env(python), timeout=120)
    lines = r.stdout.split()
    if r.returncode != 0 or len(lines) < 3:
        return None
    return lines[0], lines[1] == "True", lines[2] == "True"


def nvidia_lib_dirs(python: str) -> list[str]:
    """PyTorch+CUDA via pip nem sempre acha o cuDNN sozinho no Linux ("Unable to load libcudnn_graph")."""
    if sys.platform != "linux":
        return []
    venv = Path(python).parent.parent
    return [str(p) for p in sorted((venv / "lib").glob("python*/site-packages/nvidia/*/lib")) if p.is_dir()]


def gpu_env(python: str | None) -> dict[str, str]:
    env = dict(os.environ, PYTHONUNBUFFERED="1", PYTHONIOENCODING="utf-8")
    dirs = nvidia_lib_dirs(python) if python else []
    if dirs:
        env["LD_LIBRARY_PATH"] = os.pathsep.join(dirs + ([env["LD_LIBRARY_PATH"]] if env.get("LD_LIBRARY_PATH") else []))
    return env


def environment(custom: str | None) -> dict:
    ffmpeg = find_ffmpeg()
    demucs = find_demucs(custom)
    info = {"demucs": demucs, "ffmpeg": ffmpeg, "torch": None, "cuda": None, "mps": None}
    if demucs:
        py = python_of(demucs)
        probed = probe_torch(py) if py else None
        if probed:
            info["torch"], info["cuda"], info["mps"] = probed
    return info


_PCT = re.compile(r"(\d{1,3})%\|")
_BAG = re.compile(r"bag of (\d+) models")


def separate(
    demucs: str,
    model: str,
    device: str,
    track: Path,
    out_dir: Path,
    emit: Callable[[str, object], None],
    on_start: Callable[[subprocess.Popen], None],
) -> list[tuple[str, Path]]:
    """Executa o Demucs e devolve [(nome_da_pista, arquivo)]. Levanta RuntimeError em caso de falha."""
    if model not in MODELS:
        raise RuntimeError(f"Modelo desconhecido: {model}")
    cmd = [demucs, "-n", model, "-o", str(out_dir), "--filename", "{stem}.{ext}"]
    if device != "auto":
        cmd += ["-d", device]
    cmd.append(str(track))

    proc = subprocess.Popen(
        cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        env=gpu_env(python_of(demucs)), **popen_kwargs(),
    )
    on_start(proc)

    n_models, bar, last, separating = 1, 0, 0.0, False
    tail: list[str] = []
    line = bytearray()

    def handle(text: str) -> None:
        nonlocal n_models, bar, last, separating
        m = _PCT.search(text)
        if m:
            p = float(m.group(1))
            # A barra de separação tem unidade "seconds"; a do download do modelo, bytes (MB).
            if "seconds" in text:
                separating = True
                if p < last and last >= 99:
                    bar += 1  # próxima barra (modelos "bag", ex.: htdemucs_ft)
                last = p
                emit("progress", {"phase": "separate", "percent": (min(bar, n_models - 1) + p / 100) / n_models * 100})
            else:
                emit("progress", {"phase": "download", "percent": p})
            return
        b = _BAG.search(text)
        if b:
            n_models = max(1, int(b.group(1)))
        tail.append(text)
        del tail[:-8]
        emit("status", text)

    assert proc.stderr is not None
    while chunk := proc.stderr.read1(4096):
        for b in chunk:
            if b in (10, 13):
                text = line.decode("utf-8", "replace").strip()
                line.clear()
                if text:
                    handle(text)
            else:
                line.append(b)
    code = proc.wait()
    if code != 0:
        raise RuntimeError("O Demucs terminou com erro:\n" + "\n".join(tail[-6:]))

    stems_dir = out_dir / model
    files = [(p.stem, p) for p in stems_dir.glob("*.wav")] if stems_dir.is_dir() else []
    if not files:
        raise RuntimeError("O Demucs não gerou nenhuma pista.")
    files.sort(key=lambda s: STEM_ORDER.index(s[0]) if s[0] in STEM_ORDER else 99)
    return files


__all__ = ["environment", "separate", "kill_tree", "MODELS"]
