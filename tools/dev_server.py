"""Локальный сервер для разработки: раздаёт папку app/ и принимает POST /save/<имя>.svg,
чтобы сохранять собранные в браузере композиции в examples/ (так сделаны примеры в README).
Запуск из папки app:  python tools/dev_server.py 8771
"""
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXAMPLES = os.path.join(ROOT, "examples")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_POST(self):
        m = re.fullmatch(r"/save/([a-z0-9\-]+\.svg)", self.path)
        if not m:
            self.send_error(404)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        os.makedirs(EXAMPLES, exist_ok=True)
        with open(os.path.join(EXAMPLES, m.group(1)), "wb") as f:
            f.write(body)
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8771
    http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
