"""Ponto de entrada: sobe a API local e abre a interface numa janela do WebUI."""
from __future__ import annotations

import json
import platform
import shutil
import sys
import tempfile
import time
from pathlib import Path

from .server import App


def resource_dir() -> Path:
    """Pasta com a interface compilada (dentro do pacote ou do executável do PyInstaller)."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent)) / "ui"
    return Path(__file__).resolve().parent / "ui"


def _patch_webui_loader() -> None:
    """A wheel do webui2 procura `webui-linux-clang-*` no Linux mas traz `webui-linux-gcc-*`; sem este ajuste
    ele tentaria baixar a versão "nightly" do GitHub no primeiro uso."""
    from webui import load_library as ll

    original = ll._get_library_folder_name

    def folder() -> str:
        name = original()
        if platform.system() == "Linux" and not Path(ll._get_current_folder() + name).exists():
            alt = name.replace("linux-clang", "linux-gcc")
            if Path(ll._get_current_folder() + alt).exists():
                return alt
        return name

    ll._get_library_folder_name = folder


def cleanup_stale(max_age_hours: float = 6) -> None:
    """Remove pastas temporárias de execuções anteriores que foram encerradas à força."""
    cutoff = time.time() - max_age_hours * 3600
    for d in Path(tempfile.gettempdir()).glob("demucs-splitter-gui-*"):
        try:
            if d.is_dir() and d.stat().st_mtime < cutoff:
                shutil.rmtree(d, ignore_errors=True)
        except OSError:
            pass


def self_test() -> int:
    """Verifica o pacote (interface embutida + biblioteca nativa do WebUI) sem abrir janela. Usado na CI."""
    ui = resource_dir()
    if not (ui / "index.html").exists():
        print(f"FALHA: interface ausente em {ui}")
        return 1
    try:
        _patch_webui_loader()
        from webui import webui

        webui.Window()
        import yt_dlp  # noqa: F401
        from yt_dlp.extractor.youtube import YoutubeIE  # noqa: F401  (extratores são carregados sob demanda)
    except Exception as e:  # noqa: BLE001
        print(f"FALHA: dependência não carregou: {e}")
        return 1
    print("OK")
    return 0


def api_only(config_path: Path) -> int:
    """Modo de desenvolvimento: só a API local, sem janela. Escreve porta e token em `config_path`
    para o servidor de desenvolvimento da interface (Vite) ler."""
    import signal
    import threading

    app = App()
    app.start()
    config_path.write_text(json.dumps({"base": f"http://127.0.0.1:{app.port}", "token": app.token}))
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    print(f"API em http://127.0.0.1:{app.port} (config em {config_path})", flush=True)
    try:
        stop.wait()
    finally:
        config_path.unlink(missing_ok=True)
        app.shutdown()
    return 0


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    if "--api-only" in sys.argv:
        i = sys.argv.index("--api-only")
        if i + 1 >= len(sys.argv):
            print("Uso: --api-only <arquivo-de-config.json>", file=sys.stderr)
            return 2
        return api_only(Path(sys.argv[i + 1]).resolve())
    cleanup_stale()
    ui = resource_dir()
    if not (ui / "index.html").exists():
        print(f"Interface não encontrada em {ui}. Rode `make ui` antes.", file=sys.stderr)
        return 1

    app = App()
    app.start()
    # A interface é servida pelo WebUI a partir de uma cópia temporária, onde escrevemos a configuração da execução.
    root = Path(tempfile.mkdtemp(prefix="demucs-splitter-gui-ui-"))
    shutil.copytree(ui, root, dirs_exist_ok=True)
    (root / "config.js").write_text(
        "window.__STEM_API__ = " + json.dumps({"base": f"http://127.0.0.1:{app.port}", "token": app.token}) + ";\n"
    )

    try:
        _patch_webui_loader()
        from webui import webui

        window = webui.Window()
        window.set_root_folder(str(root))
        window.set_size(1100, 820)
        window.set_minimum_size(360, 520)
        if not window.show("index.html"):
            raise RuntimeError("não foi possível abrir uma janela")
        webui.wait()
    except Exception as e:  # noqa: BLE001
        print(f"Não foi possível abrir a janela ({e}). Instale um navegador (Chrome, Edge ou Firefox).", file=sys.stderr)
        return 1
    finally:
        app.shutdown()
        shutil.rmtree(root, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
