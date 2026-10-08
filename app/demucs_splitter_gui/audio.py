"""Conversões com ffmpeg."""
from __future__ import annotations

from functools import lru_cache
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


# Qualidade máxima de cada codificador: Vorbis q10 (~500 kbps VBR) e MP3 V0 (~245 kbps VBR).
ENCODERS = {
    "ogg": ["-c:a", "libvorbis", "-q:a", "10"],
    "mp3": ["-c:a", "libmp3lame", "-q:a", "0"],
}
_NEEDS = {"ogg": "libvorbis", "mp3": "libmp3lame"}


@lru_cache(maxsize=1)
def available_formats() -> list[str]:
    """Formatos de exportação suportados pelo ffmpeg instalado, do melhor para o mais compatível (WAV por último)."""
    found = ["wav"]
    ffmpeg = find_ffmpeg()
    if ffmpeg:
        out = run([ffmpeg, "-hide_banner", "-encoders"]).stdout
        found = [f for f, enc in _NEEDS.items() if enc in out] + found
    return found


def encode(src: Path, dst: Path, fmt: str) -> None:
    if fmt not in ENCODERS or fmt not in available_formats():
        raise ValueError(f"Formato não suportado: {fmt}")
    tmp = dst.with_name(dst.stem + ".partial" + dst.suffix)
    _ffmpeg(["-i", str(src), "-vn", *ENCODERS[fmt], str(tmp)])
    tmp.replace(dst)
