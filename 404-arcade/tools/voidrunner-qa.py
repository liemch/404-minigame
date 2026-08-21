"""
voidrunner-qa.py — integration test VOID RUNNER 404 trên Chrome headless (CDP).

Yêu cầu:
  1) Static server tại workspace root:  python3 -m http.server 8404
  2) Chrome headless port RIÊNG 9224:
     google-chrome --headless=new --remote-debugging-port=9224 \
       --user-data-dir=/tmp/chrome-void --window-size=1440,900 \
       --mute-audio --enable-unsafe-swiftshader about:blank
  3) python3 tools/voidrunner-qa.py   (chạy từ 404-arcade/)

Kiểm tra: card + lazy-load, start screen, movement WASD/jump, HUD
(timer/speed/energy/checkpoint), pause + settings persist, respawn,
finish → results, restart, vòng đời sạch khi mở/đóng 3 lần.
"""

import base64
import json
import os
import socket
import struct
import sys
import time
import urllib.request

BASE = os.environ.get("VR_QA_BASE", "http://127.0.0.1:8404/404-arcade/")
SHOT_DIR = os.environ.get("VR_QA_SHOTS", os.path.join(os.path.dirname(__file__), "vr-shots"))
PORT = int(os.environ.get("VR_QA_PORT", "9224"))


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
    def __init__(self, port=PORT):
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
                    continue
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


def key(c, code, kind="keydown"):
    c.js(f"window.dispatchEvent(new KeyboardEvent('{kind}',{{code:'{code}',bubbles:true}}));true")


def open_void_runner(c):
    c.js(sr("[...sr.querySelectorAll('.game-card')].find(card => card.textContent.includes('Void Runner'))?.querySelector('.card-play')?.click(); true"))
    return wait_for(c, "sr.querySelector('.vr-screen')?.dataset.screen === 'start'", timeout=12)


def main():
    c = CDP()
    c.cmd("Page.enable")
    c.cmd("Runtime.enable")
    c.cmd("Log.enable")
    c.cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
    c.cmd("Emulation.setTouchEmulationEnabled", {"enabled": False})

    print("== Home ==")
    c.cmd("Page.navigate", {"url": BASE})
    time.sleep(1.8)
    n_cards = c.js(sr("sr.querySelectorAll('.game-card').length"))
    check("card game >= 6 (có Void Runner)", isinstance(n_cards, int) and n_cards >= 6, f"{n_cards} card")
    check("card Void Runner 404 hiển thị",
          c.js(sr("[...sr.querySelectorAll('.game-card')].some(x => x.textContent.includes('Void Runner 404'))")))
    check("lazy-load: chưa tải module game nào",
          c.js("performance.getEntriesByType('resource').filter(r=>r.name.includes('/games/')).length") == 0)
    console_clean(c, "home")

    print("\n== Void Runner: start screen ==")
    c.js("window.__ARCADE_VOIDRUNNER_TEST__ = true; true")
    check("start screen hiện", open_void_runner(c))
    time.sleep(1.2)
    check("nút BẮT ĐẦU CHẠY", c.js(sr("!!sr.querySelector('.vr-cta')")))
    check("panel điều khiển đủ 7 dòng", c.js(sr("sr.querySelectorAll('.vr-ctl .row').length")) == 7)
    check("hàng ĐỘ KHÓ + CHẤT LƯỢNG", c.js(sr("sr.querySelectorAll('.vr-opt-row').length")) == 2)
    c.shot(f"{SHOT_DIR}/vr-start.png")
    console_clean(c, "start")

    print("\n== Vào trận + movement ==")
    c.js(sr("sr.querySelector('.vr-cta').click(); true"))
    time.sleep(1)
    check("HUD hiện khi vào trận", c.js(sr("!sr.querySelector('.vr-hud').hidden")))
    check("debug hook sẵn sàng", c.js("!!window.__VR_DEBUG__"))

    z0 = c.js("window.__VR_DEBUG__.state().pos[2]")
    key(c, "KeyW")
    time.sleep(1.3)
    z1 = c.js("window.__VR_DEBUG__.state().pos[2]")
    check("W di chuyển tới trước (-Z)", isinstance(z1, (int, float)) and z1 < z0 - 3, f"z {z0:.1f} → {z1:.1f}")
    spd = c.js(sr("sr.querySelector('.vr-panel.speed .val')?.textContent"))
    check("HUD tốc độ cập nhật", spd not in (None, "0.0"), f"speed={spd}")

    key(c, "Space")
    time.sleep(0.25)
    key(c, "Space", "keyup")
    y_air = c.js("window.__VR_DEBUG__.state().pos[1]")
    check("Space nhảy (y > 0.2)", isinstance(y_air, (int, float)) and y_air > 0.2, f"y={y_air:.2f}")
    time.sleep(1.2)

    t_txt = c.js(sr("sr.querySelector('.vr-time')?.textContent"))
    check("timer chạy mm:ss.mmm", bool(t_txt) and t_txt != "00:00.000", t_txt or "?")
    key(c, "KeyW", "keyup")
    time.sleep(0.4)
    c.shot(f"{SHOT_DIR}/vr-play.png")
    console_clean(c, "gameplay")

    print("\n== Checkpoint qua cổng thật ==")
    # Chạy thẳng từ start qua gate CP1 (z=-28)
    key(c, "KeyW")
    key(c, "ShiftLeft")
    ok_cp = False
    end = time.time() + 9
    while time.time() < end:
        st = c.js("window.__VR_DEBUG__.state()")
        if st and st.get("checkpointCount", 0) >= 1:
            ok_cp = True
            break
        time.sleep(0.4)
    key(c, "KeyW", "keyup")
    key(c, "ShiftLeft", "keyup")
    check("qua CHECKPOINT 1 khi chạy thật", ok_cp)
    check("HUD checkpoint 1/8", "1/8" in (c.js(sr("sr.querySelector('.vr-cp .t')?.textContent")) or ""))

    print("\n== Respawn (rơi/laser) ==")
    falls0 = c.js("window.__VR_DEBUG__.state().falls")
    c.js("window.__VR_DEBUG__.die(); true")
    time.sleep(0.8)
    st = c.js("window.__VR_DEBUG__.state()")
    check("falls +1 sau die", st["falls"] == falls0 + 1, f"falls={st['falls']}")
    check("respawn về checkpoint (z gần -29.5)", abs(st["pos"][2] - (-29.5)) < 3, f"z={st['pos'][2]:.1f}")

    print("\n== Pause + settings ==")
    key(c, "KeyP")
    time.sleep(0.5)
    check("pause menu hiện", c.js(sr("sr.querySelector('.vr-screen')?.dataset.screen")) == "pause")
    check("đủ 5 nút menu", c.js(sr("sr.querySelectorAll('.vr-menu-btn').length")) == 5)
    check("3 slider (âm lượng/độ nhạy/FOV)", c.js(sr("sr.querySelectorAll('.vr-range').length")) == 3)
    check("seg chất lượng LOW/MEDIUM/HIGH", c.js(sr("sr.querySelectorAll('.vr-seg button').length")) == 3)
    check("2 toggle (rung + giảm chuyển động)", c.js(sr("sr.querySelectorAll('.vr-switch').length")) == 2)
    c.shot(f"{SHOT_DIR}/vr-pause.png")

    # Đổi FOV bằng slider thật + toggle rung, kiểm tra persist
    shake_before = c.js("JSON.parse(localStorage.getItem('arcade404:v1')||'{}').prefs?.['void-runner-settings']?.shake")
    if shake_before is None:
        shake_before = True
    c.js(sr("(() => { const r = sr.querySelectorAll('.vr-range')[2]; r.value = 100; r.dispatchEvent(new Event('input', {bubbles:true})); return true; })()"))
    c.js(sr("sr.querySelectorAll('.vr-switch')[0].click(); true"))
    time.sleep(0.3)
    prefs = c.js("JSON.parse(localStorage.getItem('arcade404:v1')||'{}').prefs?.['void-runner-settings']")
    check("FOV=100 persist vào storage", bool(prefs) and prefs.get("fov") == 100, str(prefs)[:80])
    check("toggle rung màn hình đảo + persist", bool(prefs) and prefs.get("shake") == (not shake_before),
          f"{shake_before}→{prefs.get('shake')}")
    console_clean(c, "pause")

    c.js(sr("[...sr.querySelectorAll('.vr-menu-btn')].find(b=>b.textContent.includes('TIẾP TỤC')).click(); true"))
    time.sleep(0.5)
    check("resume về gameplay", c.js(sr("!sr.querySelector('.vr-screen')")))

    print("\n== Finish → results ==")
    c.js("window.__VR_DEBUG__.finish(); true")
    time.sleep(0.8)
    check("màn kết quả hiện", c.js(sr("sr.querySelector('.vr-screen')?.dataset.screen")) == "over")
    check("có thời gian + 4 thẻ chỉ số",
          c.js(sr("!!sr.querySelector('.vr-final-time .num') && sr.querySelectorAll('.vr-statcard').length === 4")))
    best = c.js("JSON.parse(localStorage.getItem('arcade404:v1')||'{}').prefs?.['void-runner-best-time']")
    check("best time lưu storage", isinstance(best, (int, float)) and best > 0, f"best={best}")
    score_saved = c.js("JSON.parse(localStorage.getItem('arcade404:v1')||'{}').scores?.['void-runner']?.best")
    check("điểm lưu qua onGameOver", isinstance(score_saved, (int, float)) and score_saved > 0, f"score={score_saved}")
    c.shot(f"{SHOT_DIR}/vr-over.png")
    console_clean(c, "results")

    print("\n== Restart từ results ==")
    c.js(sr("[...sr.querySelectorAll('.vr-abtn')].find(b=>b.textContent.includes('CHẠY LẠI')).click(); true"))
    time.sleep(0.8)
    check("chạy lại: HUD hiện, timer reset",
          c.js(sr("!sr.querySelector('.vr-hud').hidden")) and c.js("window.__VR_DEBUG__.state().runTime") < 2)

    print("\n== Physics: wall-run / slide / mover / boost / laser ==")
    # Wall-run: rơi khỏi mép zone 3 cạnh tường phải → bám tường đánh dấu
    c.js("window.__VR_DEBUG__.place(1.8, 0, -74.8, 0); true")
    key(c, "KeyW")
    key(c, "ShiftLeft")
    saw_wall = False
    end = time.time() + 4
    while time.time() < end:
        st = c.js("window.__VR_DEBUG__.state()")
        if st.get("wallRun"):
            saw_wall = True
            break
        time.sleep(0.12)
    key(c, "KeyW", "keyup")
    key(c, "ShiftLeft", "keyup")
    check("wall-run bám tường đánh dấu", saw_wall)
    time.sleep(1.2)

    # Slide qua cổng SLIDE (giữ Ctrl) — qua được trần thấp
    c.js("window.__VR_DEBUG__.place(-5.5, 0, -126.5, Math.PI/2); true")
    key(c, "KeyW")
    time.sleep(0.6)
    key(c, "ControlLeft")
    slid = False
    st = None
    end = time.time() + 3.5
    while time.time() < end:
        st = c.js("window.__VR_DEBUG__.state()")
        if st.get("sliding"):
            slid = True
        if st["pos"][0] < -12.6:
            break
        time.sleep(0.12)
    key(c, "ControlLeft", "keyup")
    key(c, "KeyW", "keyup")
    check("slide qua cổng SLIDE", slid and st["pos"][0] < -12.6, f"x={st['pos'][0]:.1f}")

    # Không trượt → bị cổng chặn (không xuyên trần)
    c.js("window.__VR_DEBUG__.place(-5.5, 0, -126.5, Math.PI/2); true")
    key(c, "KeyW")
    time.sleep(2)
    key(c, "KeyW", "keyup")
    st = c.js("window.__VR_DEBUG__.state()")
    check("đứng thẳng bị cổng SLIDE chặn", st["pos"][0] > -11.6, f"x={st['pos'][0]:.1f}")

    # Moving platform (trục Y) truyền displacement cho player — đo qua
    # nửa chu kỳ (2.1 s) để không rơi vào lúc sin ở đỉnh
    c.js("window.__VR_DEBUG__.place(-61, 2.6, -126.5, Math.PI/2); true")
    time.sleep(0.7)
    y0 = c.js("window.__VR_DEBUG__.state()")["pos"][1]
    time.sleep(2.1)
    st = c.js("window.__VR_DEBUG__.state()")
    check("mover truyền displacement (y đổi, vẫn grounded)",
          st["grounded"] and abs(st["pos"][1] - y0) > 0.5, f"y {y0:.2f}→{st['pos'][1]:.2f}")

    # Jump pad boost bay qua gap 14 m (phải đáp đúng landing platform,
    # không rơi — falls không tăng)
    falls_b = c.js("window.__VR_DEBUG__.state()")["falls"]
    c.js("window.__VR_DEBUG__.place(-95, 0, -85.5, Math.PI); true")
    key(c, "KeyW")
    flew = False
    end = time.time() + 4.5
    st = None
    while time.time() < end:
        st = c.js("window.__VR_DEBUG__.state()")
        if -66 < st["pos"][2] < -50 and st["grounded"]:
            flew = True
            break
        if st["falls"] > falls_b:
            break
        time.sleep(0.15)
    key(c, "KeyW", "keyup")
    check("jump pad boost bay qua gap 14m", flew and st["falls"] == falls_b,
          f"z={st['pos'][2]:.1f} falls {falls_b}→{st['falls']}")

    # Chạm laser → respawn + falls tăng
    falls0 = c.js("window.__VR_DEBUG__.state()")["falls"]
    c.js("window.__VR_DEBUG__.place(-95, 0, -116, Math.PI); true")
    time.sleep(3.4)
    st = c.js("window.__VR_DEBUG__.state()")
    check("chạm laser → respawn + falls tăng", st["falls"] > falls0, f"falls {falls0}→{st['falls']}")
    console_clean(c, "physics")

    print("\n== Vòng đời: đóng/mở 3 lần ==")
    clean = True
    for i in range(3):
        c.js(sr("[...sr.querySelectorAll('.vr-btn')].find(b=>b.textContent.includes('ĐỔI GAME'))?.click(); true"))
        time.sleep(0.7)
        empty = c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0"))
        if not empty:
            clean = False
            break
        if i < 2:
            if not open_void_runner(c):
                clean = False
                break
            c.js(sr("sr.querySelector('.vr-cta').click(); true"))
            time.sleep(0.8)
    check("mở/đóng 3 lần: surface sạch", clean)
    console_clean(c, "lifecycle")

    print("\n========== KẾT QUẢ ==========")
    print(f"PASS: {len(PASS)}  FAIL: {len(FAIL)}")
    for f in FAIL:
        print("  FAIL:", f)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
