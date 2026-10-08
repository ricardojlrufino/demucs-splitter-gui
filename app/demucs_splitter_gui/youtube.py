"""Download do áudio de um vídeo do YouTube usando a biblioteca yt-dlp (embutida no app, sem programa externo)."""
from __future__ import annotations

from pathlib import Path
from typing import Callable
from urllib.parse import urlparse

HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"}
MAX_SECONDS = 3 * 3600


def validate(url: str) -> str:
    """Aceita só links http(s) do YouTube (evita baixar de qualquer site ou passar opções ao yt-dlp)."""
    url = (url or "").strip()
    u = urlparse(url)
    if u.scheme not in ("http", "https") or (u.hostname or "").lower() not in HOSTS:
        raise ValueError("Cole um link do YouTube (youtube.com ou youtu.be).")
    return url


def download(
    url: str,
    folder: Path,
    on_progress: Callable[[float], None],
    is_cancelled: Callable[[], bool],
) -> tuple[str, Path]:
    """Baixa o melhor áudio para `folder/source.<ext>` e devolve (título, arquivo)."""
    import yt_dlp
    from yt_dlp.utils import DownloadCancelled, DownloadError

    def hook(d: dict) -> None:
        if is_cancelled():
            raise DownloadCancelled("cancelado")
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            if total:
                on_progress(min(100.0, d.get("downloaded_bytes", 0) / total * 100))
        elif d.get("status") == "finished":
            on_progress(100.0)

    class Quiet:  # o yt-dlp escreve erros no stderr mesmo com quiet; o app mostra a mensagem na interface
        def debug(self, *_): ...
        def info(self, *_): ...
        def warning(self, *_): ...
        def error(self, *_): ...

    opts = {
        "logger": Quiet(),
        "format": "bestaudio/best",
        "outtmpl": str(folder / "source.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "cachedir": False,
        "socket_timeout": 30,
        "retries": 3,
        "match_filter": yt_dlp.utils.match_filter_func(f"!is_live & duration<={MAX_SECONDS}"),
        "progress_hooks": [hook],
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except DownloadCancelled:
        raise RuntimeError("Download cancelado.") from None
    except DownloadError as e:
        msg = str(e).removeprefix("ERROR: ").strip()
        raise RuntimeError(
            f"Não foi possível baixar o vídeo: {msg}\nSe o erro persistir, o YouTube pode ter mudado; atualize o aplicativo."
        ) from None

    files = [p for p in folder.glob("source.*") if p.suffix not in (".part", ".ytdl")]
    if not files:
        raise RuntimeError("Vídeo ignorado: transmissão ao vivo ou mais longo que 3 horas.")
    return str((info or {}).get("title") or "YouTube"), files[0]
