"""
expansion11-qa.py — integration test cho 5 game expansion 11–15 trên
Chrome headless CDP (PORT 9223).

Chuẩn bị:
  1) python3 -m http.server 8404 (tại workspace root)
  2) google-chrome --headless=new --remote-debugging-port=9223 \
       --user-data-dir=/tmp/chrome-exp11 --no-first-run --window-size=1440,900 \
       --mute-audio --enable-unsafe-swiftshader about:blank
  3) python3 tools/expansion11-qa.py [brick|laser|golf|typing|astro|old|all]

Ảnh chụp lưu tại tools/shots-exp11/ (không dùng /tmp).
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
PORT = int(os.environ.get("EXP11_CDP_PORT", "9223"))
SHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-exp11")


class WS:
    def __init__(self, url):
        rest = url[5:]
        hostport, path = rest.split("/", 1)
        host, port = hostport.split(":")
        self.sock = socket.create_connection((host, int(port)))
        self.sock.settimeout(30)
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

    def cmd(self, method, params=None, timeout=25):
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
            raise RuntimeError(json.dumps(r["exceptionDetails"])[:500])
        return r.get("result", {}).get("value")

    def shot(self, name):
        os.makedirs(SHOT_DIR, exist_ok=True)
        with open(os.path.join(SHOT_DIR, name), "wb") as f:
            f.write(base64.b64decode(self.cmd("Page.captureScreenshot", {"format": "png"})["data"]))

    def issues(self):
        out = []
        for e in self.events:
            m = e.get("method")
            if m == "Runtime.exceptionThrown":
                d = e["params"]["exceptionDetails"]
                out.append("EXCEPTION: " + (d.get("exception", {}).get("description", d.get("text", ""))[:240]))
            elif m == "Runtime.consoleAPICalled" and e["params"]["type"] in ("error", "warning", "assert"):
                out.append("CONSOLE: " + " ".join(str(a.get("value", "?")) for a in e["params"].get("args", []))[:240])
            elif m == "Log.entryAdded":
                entry = e["params"]["entry"]
                if "GPU stall due to ReadPixels" in entry.get("text", ""):
                    continue
                if entry.get("level") in ("error", "warning"):
                    out.append(f"LOG.{entry['level']}: {entry.get('text','')[:240]}")
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
    c.drain(0.35)
    issues = c.issues()
    check(f"console sạch [{label}]", len(issues) == 0, "; ".join(issues[:3]))


def wait_for(c, expr, timeout=15, step=0.3):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if c.js(sr(expr)):
                return True
        except RuntimeError:
            pass
        time.sleep(step)
    return False


def wait_state(c, var, cond, timeout=15, step=0.4):
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = c.js(f"window.{var} || null")
        if last and cond(last):
            return last
        time.sleep(step)
    return last


def key(c, code, key_name=None):
    c.js(
        f"window.dispatchEvent(new KeyboardEvent('keydown', {{code:'{code}', key:'{key_name or code}', bubbles:true}}));"
        f"window.dispatchEvent(new KeyboardEvent('keyup', {{code:'{code}', key:'{key_name or code}', bubbles:true}})); true"
    )


def key_down(c, code, key_name=None):
    c.js(f"window.dispatchEvent(new KeyboardEvent('keydown', {{code:'{code}', key:'{key_name or code}', bubbles:true}})); true")


def key_up(c, code, key_name=None):
    c.js(f"window.dispatchEvent(new KeyboardEvent('keyup', {{code:'{code}', key:'{key_name or code}', bubbles:true}})); true")


def open_game(c, title):
    ok = c.js(sr(
        "(() => { const cards = [...sr.querySelectorAll('.game-card')];"
        f"const card = cards.find(x => x.querySelector('.card-title')?.textContent === '{title}');"
        "if (!card) return false; card.querySelector('.card-play').click(); return true; })()"
    ))
    return bool(ok)


def go_home(c, fresh_storage=False):
    c.cmd("Page.navigate", {"url": BASE})
    time.sleep(1.4)
    if fresh_storage:
        c.js("localStorage.clear(); true")


def close_via_switch(c):
    c.js(sr("sr.querySelector('.exp-btns button[aria-label=\"Đổi game\"]')?.click(); true"))
    time.sleep(0.6)


def resume_via_menu(c):
    c.js(sr("[...sr.querySelectorAll('.exp-menu-btn')].find(b=>b.textContent==='TIẾP TỤC')?.click(); true"))
    time.sleep(0.3)


def open_close_leak_check(c, title, times=3):
    for i in range(times):
        open_game(c, title)
        wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'", 8)
        roots = c.js(sr("sr.querySelectorAll('.exp-root').length"))
        check(f"lần mở {i + 1}: đúng 1 exp-root", roots == 1, f"= {roots}")
        close_via_switch(c)
    check("surface sạch sau các lần mở/đóng", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))


def canvas_pointer(c, selector, fx, fy, etype="pointermove", world_w=1, world_h=1):
    """Gửi PointerEvent vào canvas theo tọa độ tỉ lệ (0..1) hoặc thế giới."""
    c.js(sr(
        "(() => {"
        f"const cv = sr.querySelector('{selector}');"
        "if (!cv) return false;"
        "const r = cv.getBoundingClientRect();"
        f"const x = r.left + ({fx} / {world_w}) * r.width;"
        f"const y = r.top + ({fy} / {world_h}) * r.height;"
        f"cv.dispatchEvent(new PointerEvent('{etype}', {{clientX: x, clientY: y, button: 0, bubbles: true, composed: true, pointerId: 7}}));"
        "return true; })()"
    ))


# ============================= BRICK BREAKER =============================

def bb_stat(c, label):
    return c.js(f"window.__BB_STATE__ ? window.__BB_STATE__.{label} : null")


def test_brick(c):
    print("\n== Brick Breaker 404 ==")
    go_home(c, fresh_storage=True)
    c.js("window.__ARCADE_EXP11_TEST__ = true; true")
    total = c.js(sr("sr.querySelectorAll('.game-card').length"))
    check("card Brick Breaker hiển thị", open_game(c, "Brick Breaker 404"), f"tổng {total} card")
    check("intro hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    c.shot("brick-intro.png")

    c.js(sr("sr.querySelector('.exp-cta').click(); true"))
    time.sleep(0.8)
    check("vào màn 1 (overlay đóng)", c.js(sr("!sr.querySelector('.exp-screen')")))
    check("sidebar: 4 nút hệ thống + panel ĐIỂM/MẠNG/MÀN/COMBO + chú giải",
          c.js(sr("sr.querySelectorAll('.bb-side .exp-btn').length")) == 4
          and c.js(sr("sr.querySelectorAll('.bb-panel').length")) == 5)
    check("3 tim MẠNG hiển thị", c.js(sr("[...sr.querySelectorAll('.bb-hearts canvas')].filter(c=>c.style.display!=='none').length")) == 3)
    check("chú giải 4 loại gạch", c.js(sr("sr.querySelectorAll('.bb-legend-row').length")) == 4)

    st = wait_state(c, "__BB_STATE__", lambda s: s.get("mode") == "play", 6)
    check("telemetry hoạt động", bool(st) and st.get("level") == 1, f"state={st}")
    check("bóng đang dính paddle", bool(st) and st.get("ballStuck") is True)

    # Chuột lái paddle
    canvas_pointer(c, ".bb-stage canvas", 0.15, 0.9)
    time.sleep(0.5)
    px1 = bb_stat(c, "paddleX")
    canvas_pointer(c, ".bb-stage canvas", 0.85, 0.9)
    time.sleep(0.5)
    px2 = bb_stat(c, "paddleX")
    check("chuột lái paddle qua trái/phải", px1 is not None and px2 is not None and px2 - px1 > 300, f"{px1} → {px2}")

    # Thả bóng bằng Space → phá được gạch
    key(c, "Space", " ")
    st = wait_state(c, "__BB_STATE__", lambda s: not s.get("ballStuck"), 5)
    check("SPACE thả bóng", bool(st) and not st.get("ballStuck"))
    st0 = bb_stat(c, "bricksLeft")
    # đưa paddle về giữa cho bóng sống lâu
    canvas_pointer(c, ".bb-stage canvas", 0.5, 0.9)
    st = wait_state(c, "__BB_STATE__", lambda s: s.get("bricksLeft", 99) < st0, 25)
    check("bóng phá được gạch", bool(st) and st.get("bricksLeft", 99) < st0, f"{st0} → {st and st.get('bricksLeft')}")
    check("điểm tăng", bool(st) and st.get("score", 0) > 0, f"score={st and st.get('score')}")
    c.shot("brick-play.png")

    # Esc pause + resume
    key(c, "Escape")
    time.sleep(0.4)
    check("Esc mở pause", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    b1 = bb_stat(c, "bricksLeft")
    time.sleep(1.0)
    b2 = bb_stat(c, "bricksLeft")
    check("gameplay dừng khi pause", b1 == b2)
    c.shot("brick-pause.png")
    resume_via_menu(c)
    check("resume xóa overlay", c.js(sr("!sr.querySelector('.exp-screen')")))

    # Mất bóng → trừ mạng
    lives0 = bb_stat(c, "lives")
    c.js("window.__BB_TEST__.dropBalls(); true")
    st = wait_state(c, "__BB_STATE__", lambda s: s.get("lives", 9) < lives0, 6)
    check("rơi hết bóng → trừ đúng 1 mạng", bool(st) and st.get("lives") == lives0 - 1, f"{lives0} → {st and st.get('lives')}")
    check("bóng hồi sinh dính paddle", bool(st) and st.get("ballStuck") is True)

    # Clear màn bằng hook test → màn kết quả
    c.js("window.__BB_TEST__.clearTo(0); true")
    check("hết gạch → màn kết quả", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'over'", 8))
    heading = c.js(sr("sr.querySelector('.exp-h1')?.textContent || ''"))
    check("heading SẠCH GẠCH", "SẠCH GẠCH" in heading, heading)
    score_txt = c.js(sr("sr.querySelector('.exp-over-score .num')?.textContent"))
    check("điểm hiển thị > 0", bool(score_txt) and score_txt not in ("0", ""), f"= {score_txt}")
    c.shot("brick-complete.png")

    # Màn tiếp theo
    c.js(sr("[...sr.querySelectorAll('.exp-ghostbtn')].find(b=>b.textContent.includes('MÀN TIẾP THEO')).click(); true"))
    time.sleep(0.8)
    st = wait_state(c, "__BB_STATE__", lambda s: s.get("level") == 2, 5)
    check("sang màn 2", bool(st) and st.get("level") == 2)
    check("HUD MÀN = 02", c.js(sr("[...sr.querySelectorAll('.bb-panel')].find(p=>p.querySelector('.lbl')?.textContent==='MÀN')?.querySelector('.val')?.textContent")) == "02")
    console_clean(c, "brick gameplay")

    # Tiến trình lưu qua đóng/mở
    close_via_switch(c)
    check("đóng game dọn sạch surface", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    check("mở lại được", open_game(c, "Brick Breaker 404"))
    check("intro hiện lại", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    cta = c.js(sr("sr.querySelector('.exp-cta')?.textContent"))
    check("tiến trình lưu (TIẾP TỤC — MÀN 02)", cta is not None and "MÀN 02" in cta, f"CTA = {cta}")
    close_via_switch(c)

    open_close_leak_check(c, "Brick Breaker 404", 3)
    console_clean(c, "brick open/close")


# ============================= LASER MAZE =============================

def lm_click_cell(c, x, y):
    """Click thật vào tâm ô (x,y) trên canvas laser-maze."""
    c.js(sr(
        "(() => {"
        f"const p = window.__LM_TEST__.cellPoint({x}, {y});"
        "const cv = sr.querySelector('.lm-board canvas');"
        "cv.dispatchEvent(new PointerEvent('pointerdown', {clientX: p.cx, clientY: p.cy, button: 0, bubbles: true, composed: true}));"
        "return true; })()"
    ))


def test_laser(c):
    print("\n== Laser Maze 404 ==")
    go_home(c, fresh_storage=True)
    c.js("window.__ARCADE_EXP11_TEST__ = true; true")
    check("card Laser Maze hiển thị", open_game(c, "Laser Maze 404"))
    check("intro hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    c.shot("laser-intro.png")

    c.js(sr("sr.querySelector('.exp-cta').click(); true"))
    time.sleep(0.8)
    check("vào màn 1", c.js(sr("!sr.querySelector('.exp-screen')")))
    check("sidebar trái: 3 panel + chú giải 7 dòng",
          c.js(sr("sr.querySelectorAll('.lm-legend-row').length")) == 7)
    check("sidebar phải: 3 nút hành động + kho gương",
          c.js(sr("sr.querySelectorAll('.lm-action').length")) == 3
          and c.js(sr("sr.querySelectorAll('.lm-slot').length")) == 1)
    st = wait_state(c, "__LM_STATE__", lambda s: s.get("mode") == "play", 6)
    check("telemetry: màn 1, 0/1 receiver", bool(st) and st.get("level") == 1 and st.get("lit") == 0 and st.get("total") == 1, f"state={st}")

    # Đặt gương SAI chỗ → xoay → gỡ (chu trình click)
    lm_click_cell(c, 2, 2)
    time.sleep(0.4)
    st = wait_state(c, "__LM_STATE__", lambda s: s.get("mirrors") == 1, 4)
    check("click ô trống đặt gương (kho 1/1)", bool(st) and st.get("mirrors") == 1)
    guong = c.js(sr("[...sr.querySelectorAll('.lm-panel')].find(p=>p.querySelector('.lbl')?.textContent==='GƯƠNG')?.querySelector('.val')?.textContent"))
    check("HUD GƯƠNG = 1/1", guong == "1/1", f"= {guong}")
    check("kho gương trống slot", c.js(sr("sr.querySelectorAll('.lm-slot.empty').length")) == 1)
    lm_click_cell(c, 3, 3)
    time.sleep(0.3)
    st = c.js("window.__LM_STATE__")
    check("hết kho → không đặt thêm được", st and st.get("mirrors") == 1)
    lm_click_cell(c, 2, 2)  # xoay / → \\
    time.sleep(0.25)
    lm_click_cell(c, 2, 2)  # gỡ
    time.sleep(0.4)
    st = wait_state(c, "__LM_STATE__", lambda s: s.get("mirrors") == 0, 4)
    check("click gương 2 lần: xoay rồi gỡ về kho", bool(st) and st.get("mirrors") == 0)

    # Undo: đặt lại rồi U
    lm_click_cell(c, 2, 2)
    time.sleep(0.3)
    key(c, "KeyU", "u")
    time.sleep(0.4)
    st = wait_state(c, "__LM_STATE__", lambda s: s.get("mirrors") == 0, 4)
    check("U hoàn tác về 0 gương", bool(st) and st.get("mirrors") == 0)

    # Đặt ĐÚNG lời giải màn 1: (5,3) rồi tia sáng receiver → màn kết quả
    lm_click_cell(c, 5, 3)
    time.sleep(0.3)
    st = wait_state(c, "__LM_STATE__", lambda s: s.get("lit") == 1, 4)
    check("gương đúng chỗ → receiver sáng", bool(st) and st.get("lit") == 1, f"lit={st and st.get('lit')}")
    check("màn kết quả hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'over'", 6))
    heading = c.js(sr("sr.querySelector('.exp-h1')?.textContent || ''"))
    check("heading HOÀN THÀNH", "HOÀN THÀNH" in heading, heading)
    stars = c.js(sr("[...sr.querySelectorAll('.exp-statcard')].find(x=>x.querySelector('.lbl')?.textContent==='SAO')?.querySelector('.val')?.textContent"))
    check("đạt 3 sao (đúng par, không hint)", stars == "★★★", f"= {stars}")
    c.shot("laser-complete.png")

    # Màn 2 + hint
    c.js(sr("[...sr.querySelectorAll('.exp-ghostbtn')].find(b=>b.textContent.includes('MÀN TIẾP THEO')).click(); true"))
    time.sleep(0.8)
    st = wait_state(c, "__LM_STATE__", lambda s: s.get("level") == 2, 5)
    check("sang màn 2", bool(st) and st.get("level") == 2)
    key(c, "KeyH", "h")
    time.sleep(0.4)
    st = wait_state(c, "__LM_STATE__", lambda s: s.get("mirrors") == 1, 4)
    check("H gợi ý đặt 1 gương đúng", bool(st) and st.get("mirrors") == 1)
    c.shot("laser-play.png")

    # Esc pause/resume
    key(c, "Escape")
    time.sleep(0.4)
    check("Esc mở pause", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    t1 = c.js("window.__LM_STATE__?.time")
    time.sleep(1.1)
    t2 = c.js("window.__LM_STATE__?.time")
    check("đồng hồ dừng khi pause", t1 == t2, f"{t1} → {t2}")
    resume_via_menu(c)
    check("resume", c.js(sr("!sr.querySelector('.exp-screen')")))

    # Giải nhanh màn 2 bằng hook → sang màn 3 → kiểm tra tiến trình
    c.js("window.__LM_TEST__.solve(); true")
    check("solve() hoàn thành màn 2", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'over'", 6))
    console_clean(c, "laser gameplay")

    close_via_switch(c)
    check("đóng game dọn sạch surface", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    check("mở lại được", open_game(c, "Laser Maze 404"))
    check("intro hiện lại", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    cta = c.js(sr("sr.querySelector('.exp-cta')?.textContent"))
    check("tiến trình lưu (TIẾP TỤC — MÀN 03)", cta is not None and "MÀN 03" in cta, f"CTA = {cta}")
    close_via_switch(c)

    open_close_leak_check(c, "Laser Maze 404", 3)
    console_clean(c, "laser open/close")


# ============================= PIXEL GOLF =============================

def test_golf(c):
    print("\n== Pixel Golf 404 ==")
    go_home(c, fresh_storage=True)
    c.js("window.__ARCADE_EXP11_TEST__ = true; true")
    check("card Pixel Golf hiển thị", open_game(c, "Pixel Golf 404"))
    check("intro hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    c.shot("golf-intro.png")

    c.js(sr("sr.querySelector('.exp-cta').click(); true"))
    time.sleep(0.9)
    check("vào hố 1", c.js(sr("!sr.querySelector('.exp-screen')")))
    check("5 panel trái + hướng dẫn + thanh SỨC MẠNH",
          c.js(sr("sr.querySelectorAll('.pg-panel').length")) == 5
          and c.js(sr("!!sr.querySelector('.pg-help')"))
          and c.js(sr("sr.querySelectorAll('.pg-power .segs i').length")) == 26)
    st = wait_state(c, "__PG_STATE__", lambda s: s.get("mode") == "play", 6)
    check("telemetry: hố 1, 0 gậy, PAR 2", bool(st) and st.get("hole") == 1 and st.get("strokes") == 0 and st.get("par") == 2, f"state={st}")

    # Kéo ngắm bằng pointer thật: kéo sang TRÁI để đánh sang PHẢI
    c.js(sr(
        "(() => {"
        "const cv = sr.querySelector('.pg-stage canvas');"
        "const b = window.__PG_TEST__.ballPos();"
        "const p0 = window.__PG_TEST__.clientOf(b.x, b.y);"
        "cv.dispatchEvent(new PointerEvent('pointerdown', {clientX: p0.cx, clientY: p0.cy, button: 0, bubbles: true, composed: true, pointerId: 5}));"
        "return true; })()"
    ))
    time.sleep(0.15)
    c.js(sr(
        "(() => {"
        "const cv = sr.querySelector('.pg-stage canvas');"
        "const b = window.__PG_TEST__.ballPos();"
        "const p1 = window.__PG_TEST__.clientOf(b.x - 150, b.y);"
        "cv.dispatchEvent(new PointerEvent('pointermove', {clientX: p1.cx, clientY: p1.cy, bubbles: true, composed: true, pointerId: 5}));"
        "return true; })()"
    ))
    time.sleep(0.3)
    segs_on = c.js(sr("sr.querySelectorAll('.pg-power .segs i.on').length"))
    check("kéo ngắm → thanh lực sáng", isinstance(segs_on, int) and segs_on > 3, f"segs={segs_on}")
    c.shot("golf-aim.png")
    c.js(sr(
        "(() => {"
        "const cv = sr.querySelector('.pg-stage canvas');"
        "const b = window.__PG_TEST__.ballPos();"
        "const p1 = window.__PG_TEST__.clientOf(b.x - 150, b.y);"
        "cv.dispatchEvent(new PointerEvent('pointerup', {clientX: p1.cx, clientY: p1.cy, button: 0, bubbles: true, composed: true, pointerId: 5}));"
        "return true; })()"
    ))
    st = wait_state(c, "__PG_STATE__", lambda s: s.get("strokes") == 1, 5)
    check("thả → đánh bóng (GẬY = 1)", bool(st) and st.get("strokes") == 1)
    st = wait_state(c, "__PG_STATE__", lambda s: not s.get("moving"), 10)
    check("bóng dừng nhờ ma sát", bool(st) and not st.get("moving"), f"x={st and st.get('x')}")
    x_after = st.get("x") if st else 0
    check("bóng di chuyển sang phải", x_after > 200, f"x={x_after}")

    # Đặt bóng gần lỗ + đánh nhẹ vào lỗ (hook test)
    c.js("(() => { const h = window.__PG_TEST__.hole(); window.__PG_TEST__.place(h.x - 60, h.y); return true; })()")
    time.sleep(0.2)
    c.js("window.__PG_TEST__.shoot(0, 0.18); true")
    st = wait_state(c, "__PG_STATE__", lambda s: s.get("hole") == 2, 8)
    check("bóng vào lỗ → tự sang hố 2", bool(st) and st.get("hole") == 2, f"hole={st and st.get('hole')}")
    hole_txt = c.js(sr("[...sr.querySelectorAll('.pg-panel')].find(p=>p.querySelector('.lbl')?.textContent==='HỐ')?.querySelector('.val')?.textContent"))
    check("HUD HỐ = 02/09", hole_txt is not None and hole_txt.startswith("02"), f"= {hole_txt}")
    c.shot("golf-play.png")

    # Esc pause/resume
    key(c, "Escape")
    time.sleep(0.4)
    check("Esc mở pause", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    resume_via_menu(c)
    check("resume", c.js(sr("!sr.querySelector('.exp-screen')")))

    # Gậy phím: giữ Space tụ lực rồi thả
    key_down(c, "Space", " ")
    time.sleep(0.5)
    segs_on = c.js(sr("sr.querySelectorAll('.pg-power .segs i.on').length"))
    check("giữ SPACE tụ lực", isinstance(segs_on, int) and segs_on > 0, f"segs={segs_on}")
    key_up(c, "Space", " ")
    st = wait_state(c, "__PG_STATE__", lambda s: s.get("strokes", 0) >= 1, 4)
    check("thả SPACE đánh bóng", bool(st) and st.get("strokes", 0) >= 1)
    console_clean(c, "golf gameplay")

    # Tiến trình lưu
    close_via_switch(c)
    check("đóng game dọn sạch surface", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    check("mở lại được", open_game(c, "Pixel Golf 404"))
    check("intro hiện lại", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    cta = c.js(sr("sr.querySelector('.exp-cta')?.textContent"))
    check("tiến trình lưu (TIẾP TỤC — HỐ 02)", cta is not None and "HỐ 02" in cta, f"CTA = {cta}")
    close_via_switch(c)

    open_close_leak_check(c, "Pixel Golf 404", 3)
    console_clean(c, "golf open/close")


# ============================= TYPING RUSH =============================

def tr_type(c, text, delay=0.045):
    """Gõ chuỗi ký tự bằng KeyboardEvent(key=ch)."""
    for ch in text:
        c.js(
            "window.dispatchEvent(new KeyboardEvent('keydown', {key: %s, bubbles: true})); true"
            % json.dumps(ch)
        )
        time.sleep(delay)


def test_typing(c):
    print("\n== Typing Rush 404 ==")
    go_home(c, fresh_storage=True)
    c.js("window.__ARCADE_EXP11_TEST__ = true; true")
    check("card Typing Rush hiển thị", open_game(c, "Typing Rush 404"))
    check("intro hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    check("intro có 4 lựa chọn độ khó", c.js(sr("sr.querySelectorAll('.tr-diff').length")) == 4)
    c.js(sr("[...sr.querySelectorAll('.tr-diff')].find(b=>b.textContent==='THƯỜNG').click(); true"))
    time.sleep(0.2)
    check("chọn độ khó THƯỜNG", c.js(sr("[...sr.querySelectorAll('.tr-diff')].find(b=>b.textContent==='THƯỜNG').classList.contains('sel')")))
    c.shot("typing-intro.png")

    c.js(sr("sr.querySelector('.exp-cta').click(); true"))
    time.sleep(0.7)
    check("vào trận", c.js(sr("!sr.querySelector('.exp-screen')")))
    check("bàn phím ảo + heat map + danger line hiển thị",
          c.js(sr("sr.querySelectorAll('.tr-key').length")) > 50
          and c.js(sr("!!sr.querySelector('.tr-heat')"))
          and c.js(sr("!!sr.querySelector('.tr-danger .lbl')")))

    st = wait_state(c, "__TR_STATE__", lambda s: s.get("targets", 0) >= 1, 8)
    check("từ đầu tiên xuất hiện", bool(st) and st.get("targets", 0) >= 1, f"state={st}")

    # Gõ đúng từ gần danger nhất
    word = c.js("(() => { const ws = window.__TR_TEST__.words(); ws.sort((a,b)=>b.y-a.y); return ws[0]?.text || null; })()")
    check("đọc được từ mục tiêu", bool(word), f"= {word}")
    folded = c.js(f"(() => {{ const f = s => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/đ/g,'d').toLowerCase(); return f({json.dumps(word)}); }})()")
    tr_type(c, folded)
    st = wait_state(c, "__TR_STATE__", lambda s: s.get("wordsDone", 0) >= 1, 5)
    check("gõ đủ từ (không dấu) → hoàn thành", bool(st) and st.get("wordsDone", 0) >= 1)
    check("điểm + combo tăng", bool(st) and st.get("score", 0) > 0 and st.get("combo", 0) >= 1, f"score={st and st.get('score')} combo={st and st.get('combo')}")
    check("WPM > 0", bool(st) and st.get("wpm", 0) > 0, f"wpm={st and st.get('wpm')}")
    c.shot("typing-play.png")

    # Ký tự lạc → lỗi tăng
    e0 = c.js("window.__TR_STATE__?.errors") or 0
    tr_type(c, "999")
    st = wait_state(c, "__TR_STATE__", lambda s: s.get("errors", 0) > e0, 4)
    check("ký tự lạc ghi nhận lỗi", bool(st) and st.get("errors", 0) > e0, f"{e0} → {st and st.get('errors')}")

    # Từ chạm danger line → mất đúng 1 mạng
    wait_state(c, "__TR_STATE__", lambda s: s.get("targets", 0) >= 1, 8)
    lives0 = c.js("window.__TR_STATE__?.lives")
    c.js("window.__TR_TEST__.rush(); true")
    st = wait_state(c, "__TR_STATE__", lambda s: s.get("lives", 9) < lives0, 5)
    check("chạm danger line → -1 mạng", bool(st) and st.get("lives") == lives0 - 1, f"{lives0} → {st and st.get('lives')}")
    time.sleep(1.0)
    st2 = c.js("window.__TR_STATE__")
    check("chỉ mất đúng 1 mạng cho 1 từ", st2 and st2.get("lives") == lives0 - 1)

    # Pause: không bắt phím khi pause
    key(c, "Escape")
    time.sleep(0.4)
    check("Esc mở pause", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    w0 = c.js("window.__TR_STATE__?.wordsDone")
    er0 = c.js("window.__TR_STATE__?.errors")
    tr_type(c, "abcxyz", delay=0.02)
    time.sleep(0.4)
    check("KHÔNG bắt phím khi pause",
          c.js("window.__TR_STATE__?.wordsDone") == w0 and c.js("window.__TR_STATE__?.errors") == er0)
    c.shot("typing-pause.png")
    resume_via_menu(c)
    check("resume", c.js(sr("!sr.querySelector('.exp-screen')")))

    # Hết mạng → màn kết quả có WPM/accuracy
    for _ in range(2):
        wait_state(c, "__TR_STATE__", lambda s: s.get("targets", 0) >= 1 or s.get("mode") == "over", 10)
        c.js("window.__TR_TEST__.rush(); true")
        time.sleep(0.8)
    check("hết mạng → màn kết quả", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'over'", 12))
    cards = c.js(sr("sr.querySelectorAll('.exp-statcard').length"))
    check("kết quả có 6 thẻ chỉ số (WPM/RAW/ACC...)", cards == 6, f"= {cards}")
    c.shot("typing-over.png")
    console_clean(c, "typing gameplay")

    close_via_switch(c)
    check("đóng game dọn sạch surface", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    open_close_leak_check(c, "Typing Rush 404", 3)
    console_clean(c, "typing open/close")


# ==================== REGRESSION game cũ (smoke) ====================

def test_old_games(c):
    print("\n== Regression game cũ (smoke) ==")
    go_home(c, fresh_storage=True)
    total = c.js(sr("sr.querySelectorAll('.game-card').length"))
    check("trang chọn game đủ card", isinstance(total, int) and total >= 12, f"= {total}")
    for title in ["Endless Runner", "404 Strike", "Portal Puzzle 404", "Neon Drift 404"]:
        ok = open_game(c, title)
        time.sleep(1.6)
        stage = c.js(sr("!sr.querySelector('[data-ref=stage]')?.hidden"))
        check(f"{title}: mở được", bool(ok) and bool(stage))
        c.js(sr("sr.querySelector('.exp-btns button[aria-label=\"Đổi game\"]')?.click(); true"))
        time.sleep(0.4)
        key(c, "Escape")
        time.sleep(0.6)
        clean = c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0"))
        if not clean:
            c.js(sr("sr.querySelector('[data-ref=stage] .btn-switch')?.click(); true"))
            time.sleep(0.5)
            clean = c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0"))
        check(f"{title}: đóng sạch", bool(clean))
    console_clean(c, "old games smoke")


SECTIONS = {
    "brick": test_brick,
    "laser": test_laser,
    "golf": test_golf,
    "typing": test_typing,
    "old": test_old_games,
}


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    c = CDP()
    c.cmd("Page.enable")
    c.cmd("Runtime.enable")
    c.cmd("Log.enable")
    c.cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})

    if which == "all":
        for fn in SECTIONS.values():
            fn(c)
    else:
        SECTIONS[which](c)

    print("\n========== KẾT QUẢ ==========")
    print(f"PASS: {len(PASS)}  FAIL: {len(FAIL)}")
    for f in FAIL:
        print("  FAIL:", f)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
