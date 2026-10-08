"""Utilitários para executar programas externos (ffmpeg, demucs) em todos os sistemas."""
from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path

IS_WINDOWS = sys.platform == "win32"


def popen_kwargs() -> dict:
    """Esconde o console no Windows e cria um grupo de processos para poder cancelar tudo."""
    if IS_WINDOWS:
        return {"creationflags": subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", **popen_kwargs(), **kw)


def kill_tree(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    try:
        if IS_WINDOWS:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        proc.kill()


def find_ffmpeg() -> str | None:
    found = shutil.which("ffmpeg")
    if found:
        return found
    for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"):
        if Path(p).exists():
            return p
    return None
