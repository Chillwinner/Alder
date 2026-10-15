#!/usr/bin/env python3
import json
import os
import shutil
import subprocess
import tempfile
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

TOKEN = os.environ.get("OFFICECLI_TOKEN", "")
PORT = int(os.environ.get("PORT", "8787"))


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"ok")
            return
        self.send_error(404)

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/exec":
            self.send_error(404)
            return
        if TOKEN and self.headers.get("X-Officecli-Token") != TOKEN:
            self.send_error(401)
            return
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 20 * 1024 * 1024:
            self.send_error(413)
            return
        data = self.rfile.read(length)
        verb = (self.headers.get("X-Officecli-Verb") or "help").strip()
        suffix = (self.headers.get("X-Officecli-Suffix") or "docx").strip().lstrip(".")
        raw_args = self.headers.get("X-Officecli-Args") or "[]"
        try:
            extra = json.loads(raw_args)
            if not isinstance(extra, list):
                extra = []
            extra = [str(x) for x in extra]
        except json.JSONDecodeError:
            extra = []
        work = tempfile.mkdtemp(prefix="oc-")
        try:
            name = "doc." + suffix
            path = os.path.join(work, name)
            with open(path, "wb") as out:
                out.write(data)
            cmd = ["officecli", verb, name, *extra]
            env = os.environ.copy()
            # 不刷盘的话，set/add 只改常驻进程内存，读回来的还是原文件。
            env["OFFICECLI_RESIDENT_FLUSH"] = "each"
            timeout = int(os.environ.get("OFFICECLI_TIMEOUT", "90"))
            proc = subprocess.run(
                cmd,
                cwd=work,
                capture_output=True,
                timeout=timeout,
                env=env,
            )
            if proc.returncode == 0 and verb in {"set", "add", "remove", "move", "swap", "batch"}:
                flushed = subprocess.run(
                    ["officecli", "close", name],
                    cwd=work,
                    capture_output=True,
                    timeout=timeout,
                    env=env,
                )
                proc = subprocess.CompletedProcess(
                    proc.args,
                    proc.returncode,
                    proc.stdout + flushed.stdout,
                    proc.stderr + flushed.stderr,
                )
            log = (proc.stdout + proc.stderr).decode("utf-8", "replace")[:4000]
            with open(path, "rb") as inp:
                blob = inp.read()
            status = 200 if proc.returncode == 0 else 422
            self.send_response(status)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("X-Officecli-Exit", str(proc.returncode))
            self.send_header("X-Officecli-Log", urllib.parse.quote(log, safe=""))
            self.end_headers()
            self.wfile.write(blob)
        except subprocess.TimeoutExpired:
            self.send_error(504, "officecli timeout")
        finally:
            shutil.rmtree(work, ignore_errors=True)

    def log_message(self, *_args):
        return


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
