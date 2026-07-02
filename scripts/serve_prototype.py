#!/usr/bin/env python3
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
root = Path(__file__).resolve().parents[1] / 'apps' / 'desktop' / 'static'
os.chdir(root)
print('Serving prototype at http://127.0.0.1:8765/prototype/index.html')
ThreadingHTTPServer(('127.0.0.1', 8765), SimpleHTTPRequestHandler).serve_forever()
