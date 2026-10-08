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


# Formatos de exportação. "ogg" é o padrão (Vorbis q7, ~145-225 kbps: qualidade muito alta e arquivos bem menores);
# "ogg-max" usa q10 (~350-570 kbps, arquivos grandes). MP3 em V0 (~245 kbps VBR).
FORMATS: dict[str, dict] = {
    "ogg": {"ext": "ogg", "needs": "libvorbis", "args": ["-c:a", "libvorbis", "-q:a", "7"]},
    "ogg-max": {"ext": "ogg", "needs": "libvorbis", "args": ["-c:a", "libvorbis", "-q:a", "10"]},
    "mp3": {"ext": "mp3", "needs": "libmp3lame", "args": ["-c:a", "libmp3lame", "-q:a", "0"]},
    "wav": {"ext": "wav", "needs": None, "args": ["-c:a", "pcm_s16le"]},
}


def extension(fmt: str) -> str:
    return FORMATS[fmt]["ext"]


@lru_cache(maxsize=1)
def available_formats() -> list[str]:
    """Formatos de exportação suportados pelo ffmpeg instalado, em ordem de preferência (WAV por último)."""
    ffmpeg = find_ffmpeg()
    encoders = run([ffmpeg, "-hide_banner", "-encoders"]).stdout if ffmpeg else ""
    return [k for k, f in FORMATS.items() if f["needs"] is None or f["needs"] in encoders]


def export(src: Path, dst: Path, fmt: str, start: float | None = None, end: float | None = None) -> None:
    """Gera `dst` no formato `fmt` (wav/ogg/mp3), opcionalmente só com o trecho [start, end] em segundos."""
    if fmt not in available_formats():
        raise ValueError(f"Formato não suportado: {fmt}")
    codec = FORMATS[fmt]["args"]
    cut: list[str] = []
    if start is not None and end is not None:
        if not (0 <= start < end):
            raise ValueError("Trecho inválido.")
        cut = ["-ss", f"{start:.3f}", "-t", f"{end - start:.3f}"]
    tmp = dst.with_name(dst.stem + ".partial" + dst.suffix)
    _ffmpeg([*cut, "-i", str(src), "-vn", *codec, str(tmp)])
    tmp.replace(dst)
