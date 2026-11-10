"""Stand-ins for the release-script test (tests/deploy/release.test.sh). No dependencies.

  fake.py app <port> <slot-dir>      a "Next.js" slot: /api/health answers with the release in <slot-dir>/RELEASE,
                                     or 500 when <slot-dir>/BROKEN exists (a bad build)
  fake.py front <port> <upstream>    "nginx": forwards every request to the port named in the upstream file,
                                     re-read on each request (a graceful reload, minus nginx)
"""
import http.server, json, os, re, sys, time, urllib.request

mode, port, arg = sys.argv[1], int(sys.argv[2]), sys.argv[3]


class App(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        root = os.path.realpath(arg)
        if os.path.exists(os.path.join(root, "BROKEN")):
            self.send_response(500); self.end_headers(); return
        release = open(os.path.join(root, "RELEASE")).read().strip()
        body = json.dumps({"ok": True, "release": release}, separators=(",", ":")).encode()  # compact, like Next.js
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)

    def log_message(self, *a): pass


class Front(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        target = int(re.search(r"127\.0\.0\.1:(\d+)", open(arg).read()).group(1))
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{target}{self.path}", timeout=5) as r:
                body, code = r.read(), r.status
        except urllib.error.HTTPError as e:
            body, code = b"", e.code
        except Exception:
            body, code = b"", 502  # nginx: bad gateway
        self.send_response(code); self.end_headers(); self.wfile.write(body)

    def log_message(self, *a): pass


http.server.ThreadingHTTPServer.allow_reuse_address = True
time.sleep(0.3 if mode == "app" else 0)  # a real app takes a moment to boot
http.server.ThreadingHTTPServer(("127.0.0.1", port), App if mode == "app" else Front).serve_forever()
