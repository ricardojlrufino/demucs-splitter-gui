"""Servidor HTTP local (127.0.0.1) com a API usada pela interface.

Segurança: só escuta em loopback e exige um token aleatório por execução (`?t=`), para que outras páginas
abertas no navegador não consigam acionar o Demucs nem ler arquivos. O cliente nunca informa caminhos:
usa apenas os ids gerados aqui.
"""
from __future__ import annotations

import json
import mimetypes
import re
import secrets
import shutil
import tempfile
import threading
import time
import uuid
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from . import audio, demucs, youtube
from .procs import kill_tree

MAX_UPLOAD = 4 * 1024**3
_ID = re.compile(r"^[0-9a-f]{12}$")
_SAFE = re.compile(r"[^\w.\- ()]+", re.UNICODE)


class Job:
    def __init__(self) -> None:
        self.events: list[tuple[str, object]] = []
        self.cv = threading.Condition()
        self.proc = None
        self.cancelled = False
        self.done = False

    def emit(self, kind: str, data: object) -> None:
        with self.cv:
            self.events.append((kind, data))
            self.cv.notify_all()


class App:
    def __init__(self) -> None:
        self.token = secrets.token_urlsafe(24)
        self.work = Path(tempfile.mkdtemp(prefix="demucs-splitter-gui-"))
        self.uploads: dict[str, dict] = {}
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()
        self.httpd: ThreadingHTTPServer | None = None

    @property
    def port(self) -> int:
        assert self.httpd
        return self.httpd.server_address[1]

    def start(self) -> None:
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self))
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def shutdown(self) -> None:
        for job in list(self.jobs.values()):
            job.cancelled = True
            if job.proc:
                kill_tree(job.proc)
        if self.httpd:
            self.httpd.shutdown()
        shutil.rmtree(self.work, ignore_errors=True)

    # --- operações ---------------------------------------------------------------------------------
    def add_upload(self, name: str, reader, length: int) -> dict:
        uid = uuid.uuid4().hex[:12]
        folder = self.work / uid
        folder.mkdir()
        src = folder / ("source" + (Path(name).suffix[:10] or ".bin"))
        left = length
        with open(src, "wb") as f:
            while left > 0:
                chunk = reader.read(min(1 << 20, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
        try:
            audio.to_wav(src, folder / "original.wav")
        except Exception:
            shutil.rmtree(folder, ignore_errors=True)
            raise
        src.unlink(missing_ok=True)
        info = {"id": uid, "name": name, "wav": f"/media/{uid}/original.wav"}
        self.uploads[uid] = info
        return info

    def start_youtube(self, url: str) -> str:
        url = youtube.validate(url)
        jid = uuid.uuid4().hex[:12]
        job = Job()
        self.jobs[jid] = job
        threading.Thread(target=self._run_youtube, args=(job, url), daemon=True).start()
        return jid

    def _run_youtube(self, job: Job, url: str) -> None:
        uid = uuid.uuid4().hex[:12]
        folder = self.work / uid
        try:
            folder.mkdir()
            job.emit("status", "Baixando o áudio do YouTube…")
            title, src = youtube.download(
                url, folder, lambda p: job.emit("progress", {"phase": "download", "percent": p}), lambda: job.cancelled
            )
            job.emit("status", "Convertendo o áudio…")
            audio.to_wav(src, folder / "original.wav")
            name = f"{_SAFE.sub('_', title).strip() or 'YouTube'}{src.suffix}"
            src.unlink(missing_ok=True)
            info = {"id": uid, "name": name, "wav": f"/media/{uid}/original.wav"}
            self.uploads[uid] = info
            job.emit("done", info)
        except Exception as e:  # noqa: BLE001
            shutil.rmtree(folder, ignore_errors=True)
            job.emit("error", "Download cancelado." if job.cancelled else str(e))
        finally:
            job.done = True

    def start_job(self, req: dict) -> str:
        up = self.uploads.get(str(req.get("id", "")))
        if not up:
            raise RuntimeError("Arquivo não encontrado. Importe o áudio novamente.")
        exe = demucs.find_demucs(req.get("demucs"))
        if not exe:
            raise RuntimeError("Demucs não encontrado. Instale-o (pipx install demucs) ou informe o caminho nas configurações.")
        jid = uuid.uuid4().hex[:12]
        job = Job()
        self.jobs[jid] = job
        threading.Thread(target=self._run_job, args=(jid, job, up, req, exe), daemon=True).start()
        return jid

    def _run_job(self, jid: str, job: Job, up: dict, req: dict, exe: str) -> None:
        try:
            folder = self.work / up["id"] / f"job-{jid}"
            folder.mkdir(parents=True)
            track = self.work / up["id"] / "original.wav"
            start, end = req.get("start"), req.get("end")
            if start is not None and end is not None and float(end) > float(start):
                track = folder / "selection.wav"
                audio.cut(self.work / up["id"] / "original.wav", track, float(start), float(end) - float(start))
            out = folder / "out"
            files = demucs.separate(
                exe, str(req.get("model")), str(req.get("device", "auto")), track, out, job.emit,
                lambda p: setattr(job, "proc", p),
            )
            if job.cancelled:
                raise RuntimeError("Separação cancelada.")
            job.emit("done", {"stems": [{"name": n, "url": f"/media/{up['id']}/job-{jid}/out/{req['model']}/{p.name}"} for n, p in files]})
        except Exception as e:  # noqa: BLE001
            job.emit("error", "Separação cancelada." if job.cancelled else str(e))
        finally:
            job.done = True


def make_handler(app: App):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "DemucsSplitterGUI"

        def log_message(self, *a):  # silencioso
            pass

        # -- helpers
        def _cors(self) -> None:
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Filename")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

        def _json(self, obj, status: int = 200) -> None:
            body = json.dumps(obj).encode()
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _auth(self) -> dict | None:
            u = urlparse(self.path)
            q = parse_qs(u.query)
            if not secrets.compare_digest(q.get("t", [""])[0], app.token):
                self._json({"error": "não autorizado"}, 403)
                return None
            return {"path": u.path, "q": {k: v[0] for k, v in q.items()}}

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header("Content-Length", "0")
            self.end_headers()

        # -- rotas
        def do_GET(self):
            ctx = self._auth()
            if not ctx:
                return
            path, q = ctx["path"], ctx["q"]
            try:
                if path == "/api/env":
                    self._json(demucs.environment(q.get("demucs")))
                elif path == "/api/events":
                    self._events(q.get("job", ""))
                elif path == "/api/zip":
                    self._zip(q)
                elif path.startswith("/media/"):
                    self._media(path, q.get("download"))
                else:
                    self._json({"error": "não encontrado"}, 404)
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as e:  # noqa: BLE001
                self._json({"error": str(e)}, 500)

        def do_POST(self):
            ctx = self._auth()
            if not ctx:
                return
            path = ctx["path"]
            try:
                length = int(self.headers.get("Content-Length") or 0)
                if path == "/api/upload":
                    if length <= 0 or length > MAX_UPLOAD:
                        return self._json({"error": "arquivo inválido ou grande demais"}, 400)
                    name = unquote(self.headers.get("X-Filename", "audio"))
                    self._json(app.add_upload(Path(name).name or "audio", self.rfile, length))
                    return
                body = json.loads(self.rfile.read(length) or b"{}")
                if path == "/api/youtube":
                    self._json({"job": app.start_youtube(str(body.get("url", "")))})
                elif path == "/api/separate":
                    self._json({"job": app.start_job(body)})
                elif path == "/api/cancel":
                    job = app.jobs.get(str(body.get("job")))
                    if job:
                        job.cancelled = True
                        if job.proc:
                            kill_tree(job.proc)
                    self._json({"ok": True})
                else:
                    self._json({"error": "não encontrado"}, 404)
            except (BrokenPipeError, ConnectionResetError):
                pass
            except ValueError as e:
                self._json({"error": str(e)}, 400)
            except Exception as e:  # noqa: BLE001
                self._json({"error": str(e)}, 500)

        def _events(self, jid: str) -> None:
            job = app.jobs.get(jid)
            if not job:
                return self._json({"error": "tarefa não encontrada"}, 404)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()
            self.close_connection = True
            i = 0
            while True:
                with job.cv:
                    while i >= len(job.events) and not job.done:
                        job.cv.wait(timeout=15)
                        if i >= len(job.events) and not job.done:
                            self.wfile.write(b": ping\n\n")
                            self.wfile.flush()
                    batch, i = job.events[i:], len(job.events)
                    finished = job.done and i >= len(job.events)
                for kind, data in batch:
                    self.wfile.write(f"event: {kind}\ndata: {json.dumps(data)}\n\n".encode())
                self.wfile.flush()
                if finished:
                    return

        def _resolve(self, rel: str) -> Path | None:
            target = (app.work / rel).resolve()
            return target if target.is_file() and app.work.resolve() in target.parents else None

        def _media(self, path: str, download: str | None) -> None:
            f = self._resolve(unquote(path[len("/media/"):]))
            if not f:
                return self._json({"error": "arquivo não encontrado"}, 404)
            size = f.stat().st_size
            start, end, status = 0, size - 1, 200
            m = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else size - 1
                else:
                    start = max(0, size - int(m.group(2)))
                end = min(end, size - 1)
                status = 206
            self.send_response(status)
            self._cors()
            self.send_header("Content-Type", mimetypes.guess_type(f.name)[0] or "application/octet-stream")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(end - start + 1))
            if status == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            if download:
                self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{_quote(download)}")
            self.end_headers()
            with open(f, "rb") as fh:
                fh.seek(start)
                left = end - start + 1
                while left > 0 and (chunk := fh.read(min(1 << 20, left))):
                    self.wfile.write(chunk)
                    left -= len(chunk)

        def _zip(self, q: dict) -> None:
            base = q.get("base", "stems")
            files = [self._resolve(unquote(u.removeprefix("/media/"))) for u in q.get("urls", "").split(",") if u]
            if not files or not all(files):
                return self._json({"error": "arquivos inválidos"}, 400)
            tmp = app.work / f"zip-{uuid.uuid4().hex[:8]}.zip"
            with zipfile.ZipFile(tmp, "w", zipfile.ZIP_STORED) as z:
                for f in files:
                    z.write(f, f"{_SAFE.sub('_', base)} - {f.stem}.wav")
            try:
                size = tmp.stat().st_size
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Length", str(size))
                self.send_header("Content-Disposition", f"attachment; filename*=UTF-8''{_quote(base + ' - pistas.zip')}")
                self.end_headers()
                with open(tmp, "rb") as fh:
                    shutil.copyfileobj(fh, self.wfile)
            finally:
                tmp.unlink(missing_ok=True)

    return Handler


def _quote(s: str) -> str:
    from urllib.parse import quote
    return quote(s, safe="")
