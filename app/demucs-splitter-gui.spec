# PyInstaller: `uv run pyinstaller demucs-splitter-gui.spec`
import importlib.util
import sys
from pathlib import Path

# Interface compilada + biblioteca nativa do WebUI da plataforma atual (collect_data_files ignora binários).
webui_dir = Path(importlib.util.find_spec("webui").origin).parent
prefix = {"linux": "webui-linux", "darwin": "webui-macos", "win32": "webui-windows"}[
    "linux" if sys.platform.startswith("linux") else sys.platform
]
datas = [("demucs_splitter_gui/ui", "ui")]
datas += [(str(d), f"webui/{d.name}") for d in webui_dir.glob(f"{prefix}-*") if d.is_dir()]

a = Analysis(["run.py"], pathex=["."], datas=datas, excludes=["tkinter"])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="demucs-splitter-gui", console=False)
coll = COLLECT(exe, a.binaries, a.datas, name="demucs-splitter-gui")
