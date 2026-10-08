"""Conversões com ffmpeg."""
from __future__ import annotations

from pathlib import Path

from .procs import find_ffmpeg, run


def _ffmpeg(args: list[str]) -> None:
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        raise RuntimeError("ffmpeg não encontrado. Instale o ffmpeg e coloque-o no PATH.")
    r = run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", *args])
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg falhou: {r.stderr.strip()}")


def to_wav(src: Path, dst: Path) -> None:
    """Qualquer áudio/vídeo -> WAV 16-bit 44,1 kHz estéreo (decodifica em qualquer navegador e o Demucs lê direto)."""
    _ffmpeg(["-i", str(src), "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", str(dst)])


def cut(src: Path, dst: Path, start: float, duration: float) -> None:
    _ffmpeg(["-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(src), "-c:a", "pcm_s16le", str(dst)])
