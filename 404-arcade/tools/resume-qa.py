"""
resume-qa.py — QA nút "TIẾP TỤC" của 404 Strike với mock Pointer Lock API.

Headless Chrome không bao giờ cấp pointer lock thật nên flow người dùng
desktop (lock thành công → Esc thoát lock → pause → Tiếp tục bị cooldown
từ chối) không thể tái hiện bằng API thật. Script này mock Pointer Lock
trong page (Document.prototype.pointerLockElement + requestPointerLock/
exitPointerLock + event pointerlockchange) để mô phỏng chính xác.

Kịch bản:
  A) Vào trận → lock engaged, HUD hiện, đồng hồ giảm.
  B) Esc (mô phỏng trình duyệt tự thoát lock) → pause menu hiện, đồng hồ đứng.
  C) Cooldown: requestPointerLock bị reject khi bấm TIẾP TỤC → menu phải
     đóng, đồng hồ chạy tiếp, KHÔNG bị pause lại, có toast gợi ý click.
  D) Click canvas → lock lại engaged, game vẫn chạy.
  E) Pause bằng KeyP → TIẾP TỤC (không reject) → lock engaged, game chạy.
  F) Hết trận (test mode 12s) → màn hình over → Chơi lại → trận mới chạy.
  H) Race exit-lock trễ: pointerlockchange của exitPointerLock() về TRỄ
     (như trình duyệt thật) sau khi người chơi đã bấm TIẾP TỤC → menu
     KHÔNG được tự mở lại (lỗ hổng "tự re-pause sau resume").

Chạy:
  1) Static server tại workspace root:  python3 -m http.server 8404
  2) Chrome headless CDP port 9222
  3) python3 tools/resume-qa.py   (từ thư mục 404-arcade/)
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
SHOT_DIR = os.environ.get("ARCADE_QA_SHOTS", "/tmp/arcade-resume-qa")


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


# Mock Pointer Lock API — mô phỏng cả cooldown reject (setRejectNext) và
# việc pointerlockchange của exitPointerLock() về TRỄ như trình duyệt thật
# (setExitDelay). escExit mô phỏng người dùng nhấn Esc khi đang lock.
MOCK_JS = """
(function () {
  let lockedEl = null; let rejectNext = false; let exitDelay = 0;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => lockedEl, configurable: true });
  HTMLElement.prototype.requestPointerLock = function () {
    if (rejectNext) { rejectNext = false; return Promise.reject(new DOMException('cooldown', 'SecurityError')); }
    lockedEl = this;
    queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange')));
    return Promise.resolve();
  };
  document.exitPointerLock = function () {
    if (!lockedEl) return;
    const doExit = () => {
      if (lockedEl) { lockedEl = null; document.dispatchEvent(new Event('pointerlockchange')); }
    };
    if (exitDelay > 0) setTimeout(doExit, exitDelay);
    else doExit();
  };
  window.__lock = {
    escExit() { if (lockedEl) { lockedEl = null; document.dispatchEvent(new Event('pointerlockchange')); } },
    setRejectNext() { rejectNext = true; },
    setExitDelay(ms) { exitDelay = ms; },
    get locked() { return !!lockedEl; },
  };
})(); true
"""

PASS = []
FAIL = []


def check(name, ok, extra=""):
    (PASS if ok else FAIL).append(name)
    print(("  PASS " if ok else "  FAIL ") + name + (f" — {extra}" if extra else ""))


def sr(expr):
    return f"(() => {{ const sr = document.querySelector('arcade-404').shadowRoot; return {expr}; }})()"


RESUME_BTN = "[...sr.querySelectorAll('.sk-menu-btn')].find(b=>b.textContent==='TIẾP TỤC')"


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


def time_left(c):
    """Đọc đồng hồ .sk-time (MM:SS) → giây."""
    txt = c.js(sr("sr.querySelector('.sk-time')?.textContent")) or ""
    try:
        mm, ss = txt.split(":")
        return int(mm) * 60 + int(ss)
    except ValueError:
        return -1


def screen_name(c):
    return c.js(sr("sr.querySelector('.sk-screen')?.dataset.screen ?? null"))


def timer_running(c, timeout=3.5, step=0.3):
    """Đồng hồ có giảm không — poll thay vì đo cửa sổ cố định: headless
    SwiftShader chỉ đạt ~15fps, dt clamp 0.05s của vòng lặp game khiến giờ
    game trôi ~0.75× thời gian thật nên 1 giây hiển thị có thể lâu hơn 1s."""
    t0 = time_left(c)
    end = time.time() + timeout
    while time.time() < end:
        time.sleep(step)
        t1 = time_left(c)
        if t1 < t0:
            return True, f"{t0}s→{t1}s"
    return False, f"đứng ở {t0}s suốt {timeout}s"


def main():
    c = CDP()
    c.cmd("Page.enable")
    c.cmd("Runtime.enable")
    c.cmd("Log.enable")
    # Luôn tải module mới nhất từ src/ — tránh Chrome dùng heuristic cache
    # (http.server gửi Last-Modified) trả về code cũ khi đang sửa bug.
    c.cmd("Network.enable")
    c.cmd("Network.setCacheDisabled", {"cacheDisabled": True})
    c.cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
    c.cmd("Emulation.setTouchEmulationEnabled", {"enabled": False})

    print("== Chuẩn bị: mở trang + mock Pointer Lock + test mode ==")
    c.cmd("Page.navigate", {"url": BASE})
    time.sleep(1.6)
    c.js("window.__ARCADE_STRIKE_TEST__ = true; true")
    c.js(MOCK_JS)
    c.js(sr("sr.querySelectorAll('.card-play')[4].click(); true"))
    time.sleep(1.6)
    check("start screen hiện", screen_name(c) == "start")

    print("\n== A) Vào trận: lock engaged, HUD hiện, đồng hồ giảm ==")
    c.js(sr("sr.querySelector('.sk-cta').click(); true"))
    time.sleep(0.9)
    check("A1 mock lock engaged", c.js("window.__lock.locked") is True)
    check("A2 HUD hiện", c.js(sr("!sr.querySelector('.sk-hud').hidden")))
    ok, detail = timer_running(c)
    check("A3 đồng hồ giảm", ok, detail)
    c.shot(f"{SHOT_DIR}/a-match.png")
    console_clean(c, "A")

    print("\n== B) Esc thoát lock (trình duyệt) → pause menu ==")
    c.js("window.__lock.escExit(); true")
    time.sleep(0.3)
    check("B1 pause menu hiện", screen_name(c) == "pause")
    t0 = time_left(c)
    time.sleep(0.7)
    check("B2 đồng hồ đứng khi pause", time_left(c) == t0, f"{t0}s")
    c.shot(f"{SHOT_DIR}/b-pause.png")
    console_clean(c, "B")

    print("\n== C) TIẾP TỤC khi requestPointerLock bị cooldown reject ==")
    c.js("window.__lock.setRejectNext(); true")
    c.js(sr(f"{RESUME_BTN}.click(); true"))
    time.sleep(0.25)
    check("C1 menu đóng", screen_name(c) is None)
    check("C2 lock vẫn chưa engaged (bị reject)", c.js("window.__lock.locked") is False)
    check("C3 toast gợi ý click hiện", c.js(sr("!!sr.querySelector('.sk-toast')")))
    ok, detail = timer_running(c)
    check("C4 đồng hồ chạy tiếp (game resume thật)", ok, detail)
    check("C5 không bị pause lại ngay", screen_name(c) is None)
    c.shot(f"{SHOT_DIR}/c-resumed-no-lock.png")
    console_clean(c, "C")

    print("\n== D) Click canvas → khóa lại chuột, game vẫn chạy ==")
    c.js(sr("sr.querySelector('.sk-canvas').dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true,composed:true})); true"))
    time.sleep(0.25)
    c.js("window.dispatchEvent(new PointerEvent('pointerup',{button:0})); true")
    check("D1 lock engaged lại", c.js("window.__lock.locked") is True)
    check("D2 không có màn hình phủ", screen_name(c) is None)
    ok, detail = timer_running(c)
    check("D3 game vẫn chạy", ok, detail)
    console_clean(c, "D")

    print("\n== E) Pause bằng KeyP → TIẾP TỤC (lock được cấp) ==")
    c.js("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP',key:'p',bubbles:true})); true")
    time.sleep(0.3)
    check("E1 pause menu hiện (KeyP)", screen_name(c) == "pause")
    c.js(sr(f"{RESUME_BTN}.click(); true"))
    time.sleep(0.3)
    check("E2 menu đóng", screen_name(c) is None)
    check("E3 lock engaged lại", c.js("window.__lock.locked") is True)
    ok, detail = timer_running(c)
    check("E4 game chạy tiếp", ok, detail)
    console_clean(c, "E")

    print("\n== F) Hết trận → over → Chơi lại → trận mới chạy ==")
    check("F1 màn hình kết thúc trận", wait_for(c, "sr.querySelector('.sk-screen')?.dataset.screen === 'over'", timeout=24))
    c.shot(f"{SHOT_DIR}/f-over.png")
    c.js(sr("[...sr.querySelectorAll('.sk-over-actions button')].find(b=>b.textContent.includes('Chơi lại')).click(); true"))
    time.sleep(0.9)
    check("F2 HUD hiện lại", c.js(sr("!sr.querySelector('.sk-hud').hidden")))
    check("F3 không còn màn hình phủ", screen_name(c) is None)
    check("F4 lock engaged", c.js("window.__lock.locked") is True)
    ok, detail = timer_running(c)
    check("F5 trận mới chạy", ok, detail)
    console_clean(c, "F")

    print("\n== H) Race: pointerlockchange của exitLock về TRỄ sau resume ==")
    # Trình duyệt thật phát pointerlockchange bất đồng bộ sau exitPointerLock().
    # Nếu người chơi bấm TIẾP TỤC trước khi event kịp về (double-tap P, frame
    # nặng...), handler unlock KHÔNG được phép hiểu nhầm là Esc mà re-pause.
    c.js("window.__lock.setExitDelay(60); true")
    # Toán tử phẩy: sr() bọc biểu thức trong `return (...)` nên cả hai bước
    # (pause bằng KeyP + bấm TIẾP TỤC ngay trong cùng tick) phải là MỘT expr.
    c.js(sr(
        "(window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyP',key:'p',bubbles:true})), "
        f"{RESUME_BTN}.click(), true)"
    ))
    time.sleep(0.5)
    check("H1 menu KHÔNG tự mở lại sau resume", screen_name(c) is None)
    ok, detail = timer_running(c)
    check("H2 game chạy tiếp", ok, detail)
    check("H3 lock được khóa lại sau race", c.js("window.__lock.locked") is True)
    c.js("window.__lock.setExitDelay(0); true")
    c.shot(f"{SHOT_DIR}/h-race.png")
    console_clean(c, "H")

    print("\n========== KẾT QUẢ ==========")
    print(f"PASS: {len(PASS)}  FAIL: {len(FAIL)}")
    for f in FAIL:
        print("  FAIL:", f)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
