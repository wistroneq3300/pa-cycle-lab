from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent

class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlsplit(self.path).path in ('/', '/index.html'):
            # Fixtures are injected only by this loopback-only preview server.
            # The production index remains connected to the actual backend.
            source = (ROOT / 'static/index.html').read_text(encoding='utf-8')
            source = source.replace('</head>', '<script src="/static/js/preview-fixtures.js"></script></head>')
            body = source.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith(('/api/', '/ws/')):
            self.send_error(404, 'Design preview has no live backend')
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='PA Server Manager local UI preview')
    parser.add_argument('--port', type=int, default=8769)
    args = parser.parse_args()
    print(f'Wistron product preview: http://127.0.0.1:{args.port}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), PreviewHandler).serve_forever()
