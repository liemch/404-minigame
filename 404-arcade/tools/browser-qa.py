"""
browser-qa.py — integration test chạy trên Chrome headless thật (CDP).

Yêu cầu:
  1) Static server tại workspace root:  python3 -m http.server 8404
  2) Chrome headless:
     google-chrome --headless=new --remote-debugging-port=9222 \
       --user-data-dir=/tmp/chrome-qa --mute-audio --enable-unsafe-swiftshader about:blank
  3) python3 tools/browser-qa.py

Kiểm tra: trang chọn game (lazy-load), 404 Strike trọn vòng đời
(start → bắn → pause → kết thúc trận → dọn sạch), và IIFE build.
"""

import base64
import json
import os
import socket
import struct
import sys
import time
import urllib.request

BASE = os.environ.get("ARCADE_QA_BASE", "http://127.0.0.1:8404/404-arcade/")
SHOT_DIR = os.environ.get("ARCADE_QA_SHOTS", "/tmp/arcade-browser-qa")


class WS:
    def __init__(self, url):
        rest = url[5:]
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)))
        self.sock.settimeout(25)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\n"
            "Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        self.buf = buf.split(b"\r\n\r\n", 1)[1]

    def send(self, data):
        payload = data.encode()
        mask = os.urandom(4)
        n = len(payload)
        head = b"\x81"
        if n < 126:
            head += bytes([0x80 | n])
        elif n < 65536:
            head += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            head += bytes([0x80 | 127]) + struct.pack(">Q", n)
        self.sock.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("closed")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        while True:
            b1, b2 = self._read(2)
            op = b1 & 0x0F
            masked = b2 & 0x80
            ln = b2 & 0x7F
            if ln == 126:
                ln = struct.unpack(">H", self._read(2))[0]
            elif ln == 127:
                ln = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if masked else b""
            payload = self._read(ln)
            if mask:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if op == 0x9:
                m2 = os.urandom(4)
                self.sock.sendall(b"\x8a" + bytes([0x80 | len(payload)]) + m2 + bytes(b ^ m2[i % 4] for i, b in enumerate(payload)))
                continue
            if op == 0x8:
                raise ConnectionError("ws closed")
            if op in (0x0, 0x1, 0x2):
                return payload.decode("utf-8", "replace")


class CDP:
    def __init__(self, port=9222):
        targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
        page = next(t for t in targets if t["type"] == "page")
        self.ws = WS(page["webSocketDebuggerUrl"])
        self.mid = 0
        self.events = []

    def cmd(self, method, params=None, timeout=20):
        self.mid += 1
        mid = self.mid
        self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        end = time.time() + timeout
        while time.time() < end:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})
            self.events.append(msg)
        raise TimeoutError(method)

    def drain(self, dur=0.35):
        old = self.ws.sock.gettimeout()
        end = time.time() + dur
        try:
            while time.time() < end:
                self.ws.sock.settimeout(max(0.05, end - time.time()))
                try:
                    self.events.append(json.loads(self.ws.recv()))
                except socket.timeout:
                    break
        finally:
            self.ws.sock.settimeout(old)

    def js(self, expr):
        r = self.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        if r.get("exceptionDetails"):
            raise RuntimeError(json.dumps(r["exceptionDetails"])[:400])
        return r.get("result", {}).get("value")

    def shot(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(base64.b64decode(self.cmd("Page.captureScreenshot", {"format": "png"})["data"]))

    def issues(self):
        out = []
        for e in self.events:
            m = e.get("method")
            if m == "Runtime.exceptionThrown":
                d = e["params"]["exceptionDetails"]
                out.append("EXCEPTION: " + (d.get("exception", {}).get("description", d.get("text", ""))[:220]))
            elif m == "Runtime.consoleAPICalled" and e["params"]["type"] in ("error", "warning", "assert"):
                out.append("CONSOLE: " + " ".join(str(a.get("value", "?")) for a in e["params"].get("args", []))[:220])
            elif m == "Log.entryAdded":
                entry = e["params"]["entry"]
                if "GPU stall due to ReadPixels" in entry.get("text", ""):
                    continue  # cảnh báo hiệu năng do captureScreenshot trên SwiftShader
                if entry.get("level") in ("error", "warning"):
                    out.append(f"LOG.{entry['level']}: {entry.get('text','')[:220]}")
        self.events = []
        return out


PASS = []
FAIL = []


def check(name, ok, extra=""):
    (PASS if ok else FAIL).append(name)
    print(("  PASS " if ok else "  FAIL ") + name + (f" — {extra}" if extra else ""))


def sr(expr):
    return f"(() => {{ const sr = document.querySelector('arcade-404').shadowRoot; return {expr}; }})()"


def console_clean(c, label):
    c.drain(0.3)
    issues = c.issues()
    check(f"console sạch [{label}]", len(issues) == 0, "; ".join(issues[:3]))


def wait_for(c, expr, timeout=16, step=0.4):
    end = time.time() + timeout
    while time.time() < end:
        if c.js(sr(expr)):
            return True
        time.sleep(step)
    return False


def main():
    c = CDP()
    c.cmd("Page.enable")
    c.cmd("Runtime.enable")
    c.cmd("Log.enable")
    c.cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
    c.cmd("Emulation.setTouchEmulationEnabled", {"enabled": False})

    print("== Home ==")
    c.cmd("Page.navigate", {"url": BASE})
    time.sleep(1.6)
    check("5 card game", c.js(sr("sr.querySelectorAll('.game-card').length")) == 5)
    check(
        "lazy-load: chưa tải module game nào",
        c.js("performance.getEntriesByType('resource').filter(r=>r.name.includes('/games/')).length") == 0,
    )
    c.shot(f"{SHOT_DIR}/home.png")
    console_clean(c, "home")

    print("\n== 404 Strike: trọn vòng đời ==")
    c.js("window.__ARCADE_STRIKE_TEST__ = true; true")
    c.js(sr("sr.querySelectorAll('.card-play')[4].click(); true"))
    time.sleep(1.6)
    check("start screen", c.js(sr("sr.querySelector('.sk-screen')?.dataset.screen")) == "start")
    c.shot(f"{SHOT_DIR}/strike-start.png")
    c.js(sr("[...sr.querySelectorAll('.sk-seg button')].find(b=>b.textContent==='Dễ')?.click(); true"))
    c.js(sr("sr.querySelector('.sk-cta').click(); true"))
    time.sleep(1.4)
    check("HUD hiện khi vào trận", c.js(sr("!sr.querySelector('.sk-hud').hidden")))

    ammo0 = c.js(sr("sr.querySelector('.sk-ammo-mag')?.textContent"))
    c.js(sr("sr.querySelector('.sk-canvas').dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,composed:true})); true"))
    time.sleep(0.4)
    c.js("window.dispatchEvent(new PointerEvent('pointerup',{button:0})); true")
    ammo1 = c.js(sr("sr.querySelector('.sk-ammo-mag')?.textContent"))
    check("bắn được (đạn giảm)", ammo0 != ammo1, f"{ammo0}→{ammo1}")
    time.sleep(1.2)
    c.shot(f"{SHOT_DIR}/strike-play.png")

    c.js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP',key:'p',bubbles:true}));true")
    time.sleep(0.4)
    check("pause menu (P)", c.js(sr("sr.querySelector('.sk-screen')?.dataset.screen")) == "pause")
    c.shot(f"{SHOT_DIR}/strike-pause.png")
    c.js(sr("[...sr.querySelectorAll('.sk-menu-btn')].find(b=>b.textContent==='TIẾP TỤC').click(); true"))

    check("màn hình kết thúc trận", wait_for(c, "sr.querySelector('.sk-screen')?.dataset.screen === 'over'"))
    c.shot(f"{SHOT_DIR}/strike-over.png")
    console_clean(c, "strike")

    c.js(sr("[...sr.querySelectorAll('.sk-over-actions button')].find(b=>b.textContent.includes('Đổi game')).click(); true"))
    time.sleep(0.5)
    check("đóng game dọn sạch DOM", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))

    print("\n== IIFE build (examples/vanilla) ==")
    c.cmd("Page.navigate", {"url": BASE + "examples/vanilla/"})
    time.sleep(1.6)
    check("IIFE render đủ 5 card", c.js(sr("sr.querySelectorAll('.game-card').length")) == 5)
    console_clean(c, "iife")

    print("\n========== KẾT QUẢ ==========")
    print(f"PASS: {len(PASS)}  FAIL: {len(FAIL)}")
    for f in FAIL:
        print("  FAIL:", f)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
