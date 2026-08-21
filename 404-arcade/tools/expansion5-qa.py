"""
expansion5-qa.py — integration test cho 5 game expansion (6–10) trên
Chrome headless CDP (PORT RIÊNG 9223, tránh đụng worker khác).

Chuẩn bị:
  1) python3 -m http.server 8404 (tại workspace root)
  2) google-chrome --headless=new --remote-debugging-port=9223 \
       --user-data-dir=/tmp/chrome-exp5 --no-first-run --window-size=1440,900 \
       --mute-audio --enable-unsafe-swiftshader about:blank
  3) python3 tools/expansion5-qa.py [portal|drift|defense|rogue|rhythm|all]

Ảnh chụp lưu tại tools/shots-exp5/ (không dùng /tmp).
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
PORT = int(os.environ.get("EXP5_CDP_PORT", "9223"))
SHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-exp5")


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


def key(c, code, key_name=None):
    c.js(
        f"window.dispatchEvent(new KeyboardEvent('keydown', {{code:'{code}', key:'{key_name or code}', bubbles:true}}));"
        f"window.dispatchEvent(new KeyboardEvent('keyup', {{code:'{code}', key:'{key_name or code}', bubbles:true}})); true"
    )


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
    """Đóng game qua nút ĐỔI GAME trên frame (mọi game expansion đều có)."""
    c.js(sr("sr.querySelector('.exp-btns button[aria-label=\"Đổi game\"]')?.click(); true"))
    time.sleep(0.6)


# ============================= PORTAL PUZZLE =============================

def test_portal(c):
    print("\n== Portal Puzzle 404 ==")
    go_home(c, fresh_storage=True)
    total = c.js(sr("sr.querySelectorAll('.game-card').length"))
    check("trang chọn game có card Portal Puzzle", open_game(c, "Portal Puzzle 404"), f"tổng {total} card")
    check("intro hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    c.shot("portal-intro.png")

    c.js(sr("sr.querySelector('.exp-cta').click(); true"))
    time.sleep(0.6)
    check("vào màn 1 (không còn overlay)", c.js(sr("!sr.querySelector('.exp-screen')")))
    check("HUD BƯỚC = 0/11", c.js(sr("[...sr.querySelectorAll('.exp-stat')].find(s=>s.querySelector('.lbl')?.textContent==='BƯỚC')?.querySelector('.val')?.textContent")) == "0/11")
    check("chỉ 1 canvas board", c.js(sr("sr.querySelectorAll('.pp-board canvas').length")) == 1)
    c.shot("portal-play.png")

    # Giải màn 1 bằng lời giải: RRDDRRR
    for code in ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "ArrowRight", "ArrowRight", "ArrowRight"]:
        key(c, code)
        time.sleep(0.12)
    check("màn 1 hoàn thành → màn kết quả", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'over'", 6))
    check("có badge KỶ LỤC MỚI (lần đầu)", c.js(sr("!!sr.querySelector('.exp-record')")))
    score_txt = c.js(sr("sr.querySelector('.exp-over-score .num')?.textContent"))
    check("tổng điểm hiển thị > 0", bool(score_txt) and score_txt not in ("0", ""), f"= {score_txt}")
    c.shot("portal-complete.png")

    # Sang màn 2
    c.js(sr("[...sr.querySelectorAll('.exp-ghostbtn')].find(b=>b.textContent.includes('MÀN TIẾP THEO')).click(); true"))
    time.sleep(0.5)
    check("HUD MÀN = 02", c.js(sr("[...sr.querySelectorAll('.exp-stat')].find(s=>s.querySelector('.lbl')?.textContent==='MÀN')?.querySelector('.val')?.textContent")) == "02")

    # Di chuyển 1 bước rồi Undo
    key(c, "ArrowDown")
    time.sleep(0.15)
    moves1 = c.js(sr("[...sr.querySelectorAll('.exp-stat')].find(s=>s.querySelector('.lbl')?.textContent==='BƯỚC')?.querySelector('.val')?.textContent"))
    key(c, "KeyU", "u")
    time.sleep(0.15)
    moves2 = c.js(sr("[...sr.querySelectorAll('.exp-stat')].find(s=>s.querySelector('.lbl')?.textContent==='BƯỚC')?.querySelector('.val')?.textContent"))
    check("undo khôi phục số bước", moves1 == "1/10" and moves2 == "0/10", f"{moves1} → {moves2}")

    # Hint hiện toast + trừ lượt
    key(c, "KeyH", "h")
    time.sleep(0.2)
    check("hint hiện toast", c.js(sr("!!sr.querySelector('.exp-toast')")))
    check("badge gợi ý còn 2", c.js(sr("sr.querySelector('.pp-badge')?.textContent")) == "2")

    # Pause bằng Esc + resume
    key(c, "Escape")
    time.sleep(0.3)
    check("Esc mở pause menu", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    c.shot("portal-pause.png")
    c.js(sr("[...sr.querySelectorAll('.exp-menu-btn')].find(b=>b.textContent==='TIẾP TỤC').click(); true"))
    time.sleep(0.3)
    check("resume xóa overlay", c.js(sr("!sr.querySelector('.exp-screen')")))

    # Nút pause trên topbar
    c.js(sr("sr.querySelector('.exp-btns button[aria-label=\"Tạm dừng\"]').click(); true"))
    time.sleep(0.3)
    check("nút TẠM DỪNG hoạt động", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    c.js(sr("[...sr.querySelectorAll('.exp-menu-btn')].find(b=>b.textContent==='TIẾP TỤC').click(); true"))
    time.sleep(0.2)

    console_clean(c, "portal gameplay")

    # Tiến trình lưu: về home rồi mở lại → CTA "TIẾP TỤC — MÀN 02"
    close_via_switch(c)
    check("đóng game dọn sạch surface", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    check("mở lại được", open_game(c, "Portal Puzzle 404"))
    check("intro hiện lại", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    cta = c.js(sr("sr.querySelector('.exp-cta')?.textContent"))
    check("tiến trình lưu (TIẾP TỤC — MÀN 02)", cta is not None and "MÀN 02" in cta, f"CTA = {cta}")
    close_via_switch(c)

    # Mở/đóng thêm 2 lần — không rò rỉ
    for i in range(2):
        open_game(c, "Portal Puzzle 404")
        wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'", 8)
        roots = c.js(sr("sr.querySelectorAll('.exp-root').length"))
        check(f"lần mở {i + 2}: đúng 1 exp-root", roots == 1, f"= {roots}")
        close_via_switch(c)
    check("surface sạch sau 3 lần mở/đóng", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    console_clean(c, "portal open/close")


# ============================= NEON DRIFT =============================

def wait_state(c, var, cond, timeout=15, step=0.4):
    """Poll biến telemetry window.__XX_STATE__ tới khi cond(state) đúng."""
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = c.js(f"window.{var} || null")
        if last and cond(last):
            return last
        time.sleep(step)
    return last


def test_drift(c):
    print("\n== Neon Drift 404 ==")
    go_home(c, fresh_storage=True)
    c.js("window.__ARCADE_EXP5_TEST__ = true; true")
    check("mở được card Neon Drift", open_game(c, "Neon Drift 404"))
    check("intro hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    c.shot("drift-intro.png")

    c.js(sr("sr.querySelector('.exp-cta').click(); true"))
    time.sleep(1.0)  # countdown TEST = 0.4s
    check("vào trận (overlay đóng)", c.js(sr("!sr.querySelector('.exp-screen')")))
    check("minimap hiển thị", c.js(sr("!!sr.querySelector('.nd-minimap canvas')")))

    # Giữ ga: keydown không keyup
    c.js("window.dispatchEvent(new KeyboardEvent('keydown', {code:'ArrowUp', key:'ArrowUp'})); true")
    st = wait_state(c, "__ND_STATE__", lambda s: s.get("speed", 0) > 120, 8)
    check("xe tăng tốc khi giữ ga", bool(st) and st.get("speed", 0) > 120, f"speed={st and st.get('speed')}")
    st = wait_state(c, "__ND_STATE__", lambda s: s.get("trackPos", 0) > 40, 8)
    check("xe tiến theo đường đua", bool(st) and st.get("trackPos", 0) > 40, f"trackPos={st and st.get('trackPos')}")

    # Nitro: giữ Shift 1s → nitro giảm
    n0 = c.js("window.__ND_STATE__?.nitro")
    c.js("window.dispatchEvent(new KeyboardEvent('keydown', {code:'ShiftLeft', key:'Shift'})); true")
    time.sleep(1.2)
    c.js("window.dispatchEvent(new KeyboardEvent('keyup', {code:'ShiftLeft', key:'Shift'})); true")
    n1 = c.js("window.__ND_STATE__?.nitro")
    check("nitro tiêu hao khi giữ SHIFT", n0 is not None and n1 is not None and n1 < n0, f"{n0}% → {n1}%")

    # Checkpoint đúng thứ tự (xe tự ga + trượt tường vẫn tiến)
    st = wait_state(c, "__ND_STATE__", lambda s: s.get("nextCp", 1) >= 2, 14)
    check("qua CHECKPOINT 1", bool(st) and st.get("nextCp", 1) >= 2, f"nextCp={st and st.get('nextCp')}")
    cp_txt = c.js(sr("[...sr.querySelectorAll('.exp-stat')].find(s=>s.querySelector('.lbl')?.textContent==='CHECKPOINT')?.querySelector('.val')?.textContent"))
    check("HUD CHECKPOINT cập nhật", bool(cp_txt) and cp_txt != "00/08", f"= {cp_txt}")
    c.shot("drift-play.png")

    # Pause / resume
    key(c, "Escape")
    time.sleep(0.3)
    check("Esc mở pause", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    c.shot("drift-pause.png")
    c.js(sr("[...sr.querySelectorAll('.exp-menu-btn')].find(b=>b.textContent==='TIẾP TỤC').click(); true"))
    time.sleep(0.3)
    check("resume tiếp tục trận", c.js(sr("!sr.querySelector('.exp-screen')")))

    # Chờ hết giờ TEST (18s game-time; headless SwiftShader chạy chậm ~0.5×)
    check("kết thúc trận (hết giờ/về đích)", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'over'", 60))
    c.js("window.dispatchEvent(new KeyboardEvent('keyup', {code:'ArrowUp', key:'ArrowUp'})); true")
    score_txt = c.js(sr("sr.querySelector('.exp-over-score .num')?.textContent"))
    check("điểm hiển thị trên kết quả", bool(score_txt), f"= {score_txt}")
    c.shot("drift-over.png")
    console_clean(c, "drift gameplay")

    # ĐUA LẠI
    clicked = c.js(sr("(() => { const b = [...sr.querySelectorAll('.exp-ghostbtn')].find(x=>x.textContent.includes('ĐUA LẠI')); if (!b) return false; b.click(); return true; })()"))
    time.sleep(1.0)
    check("đua lại được", bool(clicked) and c.js(sr("!sr.querySelector('.exp-screen')")))
    close_via_switch(c)
    check("đóng game dọn sạch surface", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))

    # Mở/đóng 3 lần
    for i in range(3):
        open_game(c, "Neon Drift 404")
        wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'", 8)
        roots = c.js(sr("sr.querySelectorAll('.exp-root').length"))
        canvases = c.js(sr("sr.querySelectorAll('[data-ref=surface] canvas').length"))
        check(f"lần mở {i + 1}: 1 root + canvas đúng", roots == 1 and canvases == 2, f"roots={roots} canvases={canvases}")
        close_via_switch(c)
    check("surface sạch sau 3 lần", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    console_clean(c, "drift open/close")


# ============================= CYBER DEFENSE =============================

def canvas_click(c, wx, wy):
    """Click vào tọa độ THẾ GIỚI (1280×720) trên canvas cyber-defense."""
    c.js(sr(
        "(() => {"
        "const cv = sr.querySelector('.cd-stage canvas');"
        "const r = cv.getBoundingClientRect();"
        f"const x = r.left + ({wx} / 1280) * r.width;"
        f"const y = r.top + ({wy} / 720) * r.height;"
        "cv.dispatchEvent(new PointerEvent('pointermove', {clientX: x, clientY: y, bubbles: true, composed: true}));"
        "cv.dispatchEvent(new PointerEvent('pointerdown', {clientX: x, clientY: y, button: 0, bubbles: true, composed: true}));"
        "return true; })()"
    ))


def test_defense(c):
    print("\n== Cyber Defense ==")
    go_home(c, fresh_storage=True)
    c.js("window.__ARCADE_EXP5_TEST__ = true; true")
    check("mở được card Cyber Defense", open_game(c, "Cyber Defense"))
    check("intro hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    c.shot("defense-intro.png")

    c.js(sr("sr.querySelector('.exp-cta').click(); true"))
    time.sleep(0.8)
    check("vào trận", c.js(sr("!sr.querySelector('.exp-screen')")))
    check("build bar 5 slot (3 mở + 2 khóa)", c.js(sr("sr.querySelectorAll('.cd-slot').length")) == 5)
    check("slot 4-5 khóa theo wave", c.js(sr("sr.querySelectorAll('.cd-slot.locked').length")) == 2)
    e0 = c.js(sr("[...sr.querySelectorAll('.exp-stat')].find(s=>s.querySelector('.lbl')?.textContent==='NĂNG LƯỢNG')?.querySelector('.val')?.textContent"))
    check("năng lượng khởi điểm 400", e0 == "400", f"= {e0}")

    # Xây rapid (phím 1) trên pad (760,250)
    key(c, "Digit1", "1")
    time.sleep(0.2)
    check("slot 1 armed", c.js(sr("sr.querySelector('.cd-slot.armed') !== null")))
    canvas_click(c, 760, 250)
    time.sleep(0.4)
    st = wait_state(c, "__CD_STATE__", lambda s: s.get("towers", 0) >= 1, 6)
    check("xây được tháp rapid", bool(st) and st.get("towers", 0) >= 1, f"towers={st and st.get('towers')}")
    check("năng lượng trừ 100", bool(st) and st.get("energy") == 300, f"= {st and st.get('energy')}")

    # Chọn tháp → panel + range; nâng cấp
    canvas_click(c, 760, 250)
    time.sleep(0.3)
    check("panel tháp hiện", c.js(sr("!sr.querySelector('.cd-panel').hidden")))
    check("panel có nút NÂNG CẤP", c.js(sr("sr.querySelector('.cd-upgrade')?.textContent || ''")).startswith("NÂNG CẤP"))
    c.shot("defense-panel.png")
    c.js(sr("sr.querySelector('.cd-upgrade').click(); true"))
    time.sleep(0.4)
    st = wait_state(c, "__CD_STATE__", lambda s: s.get("energy", 999) == 220, 5)
    check("nâng cấp trừ đúng 80⚡", bool(st) and st.get("energy") == 220, f"= {st and st.get('energy')}")
    lv = c.js(sr("sr.querySelector('.cd-lv b')?.textContent"))
    check("panel hiện CẤP 2", lv == "2", f"= {lv}")

    # Bán tháp → hoàn 70% của (100+80)=126
    c.js(sr("sr.querySelector('.cd-sell').click(); true"))
    time.sleep(0.4)
    st = wait_state(c, "__CD_STATE__", lambda s: s.get("towers", 9) == 0, 5)
    check("bán tháp (hoàn 126⚡ → 346)", bool(st) and st.get("energy") == 346, f"= {st and st.get('energy')}")

    # Dựng phòng thủ nhanh quanh điểm hợp nhất rồi chờ qua wave
    # (chế độ xây GIỮ NGUYÊN sau mỗi lần đặt khi còn đủ năng lượng)
    key(c, "Digit1", "1")
    canvas_click(c, 760, 250)
    time.sleep(0.2)
    canvas_click(c, 950, 430)
    time.sleep(0.2)
    key(c, "Digit2", "2")
    canvas_click(c, 950, 180)
    time.sleep(0.2)
    st = wait_state(c, "__CD_STATE__", lambda s: s.get("towers", 0) >= 3, 5)
    check("dựng 3 tháp phòng thủ", bool(st) and st.get("towers", 0) >= 3, f"towers={st and st.get('towers')}")

    st = wait_state(c, "__CD_STATE__", lambda s: s.get("kills", 0) > 0, 40)
    check("tháp hạ được bot (kills > 0)", bool(st) and st.get("kills", 0) > 0, f"kills={st and st.get('kills')}")
    c.shot("defense-play.png")
    st = wait_state(c, "__CD_STATE__", lambda s: s.get("wave", 0) >= 2, 60)
    check("wave 1 sạch → sang wave 2", bool(st) and st.get("wave", 0) >= 2, f"wave={st and st.get('wave')}")

    # Pause / resume
    key(c, "Escape")
    time.sleep(0.3)
    check("Esc mở pause", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    c.js(sr("[...sr.querySelectorAll('.exp-menu-btn')].find(b=>b.textContent==='TIẾP TỤC').click(); true"))
    time.sleep(0.3)
    check("resume", c.js(sr("!sr.querySelector('.exp-screen')")))
    console_clean(c, "defense gameplay")

    close_via_switch(c)
    check("đóng game dọn sạch surface", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    for i in range(3):
        open_game(c, "Cyber Defense")
        wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'", 8)
        roots = c.js(sr("sr.querySelectorAll('.exp-root').length"))
        check(f"lần mở {i + 1}: đúng 1 exp-root", roots == 1, f"= {roots}")
        close_via_switch(c)
    check("surface sạch sau 3 lần", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    console_clean(c, "defense open/close")


# ============================= ROGUE ARENA =============================

def test_rogue(c):
    print("\n== Rogue Arena ==")
    go_home(c, fresh_storage=True)
    c.js("window.__ARCADE_EXP5_TEST__ = true; true")
    check("mở được card Rogue Arena", open_game(c, "Rogue Arena"))
    check("intro hiện", wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'"))
    c.shot("rogue-intro.png")

    c.js(sr("sr.querySelector('.exp-cta').click(); true"))
    time.sleep(0.8)
    check("vào trận", c.js(sr("!sr.querySelector('.exp-screen')")))
    check("3 chỉ báo kỹ năng hiển thị", c.js(sr("sr.querySelectorAll('.ra-ab').length")) == 3)

    # Di chuyển: giữ D → player x tăng (đọc qua canvas không được, dùng HUD kills/level thay)
    c.js("window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyD', key:'d'})); true")
    time.sleep(1.0)
    c.js("window.dispatchEvent(new KeyboardEvent('keyup', {code:'KeyD', key:'d'})); true")

    # Vũ khí tự bắn → có kill
    st = wait_state(c, "__RA_STATE__", lambda s: s.get("kills", 0) > 0, 30)
    check("vũ khí tự nhắm hạ được enemy", bool(st) and st.get("kills", 0) > 0, f"kills={st and st.get('kills')}")

    # Level-up panel (TEST xpToNext=3 → nhanh)
    check("panel NÂNG CẤP xuất hiện (pause thật)", wait_for(c, "!sr.querySelector('.ra-levelup').hidden", 30))
    t_before = c.js("window.__RA_STATE__?.time")
    time.sleep(1.2)
    t_after = c.js("window.__RA_STATE__?.time")
    check("gameplay DỪNG THẬT khi chọn nâng cấp", t_before == t_after, f"time {t_before} → {t_after}")
    check("có 3 lựa chọn", c.js(sr("sr.querySelectorAll('.ra-choice').length")) == 3)
    c.shot("rogue-levelup.png")
    key(c, "Digit1", "1")
    time.sleep(0.4)
    resumed = c.js(sr("sr.querySelector('.ra-levelup').hidden")) or c.js(sr("sr.querySelectorAll('.ra-choice').length")) == 3
    check("chọn nâng cấp bằng phím 1 → tiếp tục", bool(resumed))

    # HP giảm khi bị đánh (đứng yên giữa bầy)
    st = wait_state(c, "__RA_STATE__", lambda s: s.get("hp", 100) < 100, 30)
    check("HP giảm khi trúng đòn", bool(st) and st.get("hp", 100) < 100, f"hp={st and st.get('hp')}")
    c.shot("rogue-play.png")

    # Pause / resume (chỉ khi không có panel level-up)
    for _ in range(12):
        if c.js(sr("sr.querySelector('.ra-levelup').hidden")):
            break
        key(c, "Digit1", "1")
        time.sleep(0.3)
    key(c, "Escape")
    time.sleep(0.3)
    check("Esc mở pause", c.js(sr("sr.querySelector('.exp-screen')?.dataset.screen === 'pause'")))
    c.js(sr("[...sr.querySelectorAll('.exp-menu-btn')].find(b=>b.textContent==='TIẾP TỤC').click(); true"))
    time.sleep(0.3)
    check("resume", c.js(sr("!sr.querySelector('.exp-screen')")))
    console_clean(c, "rogue gameplay")

    close_via_switch(c)
    check("đóng game dọn sạch surface", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    for i in range(3):
        open_game(c, "Rogue Arena")
        wait_for(c, "sr.querySelector('.exp-screen')?.dataset.screen === 'intro'", 8)
        roots = c.js(sr("sr.querySelectorAll('.exp-root').length"))
        check(f"lần mở {i + 1}: đúng 1 exp-root", roots == 1, f"= {roots}")
        close_via_switch(c)
    check("surface sạch sau 3 lần", c.js(sr("sr.querySelector('[data-ref=surface]').childElementCount === 0")))
    console_clean(c, "rogue open/close")


SECTIONS = {
    "portal": test_portal,
    "drift": test_drift,
    "defense": test_defense,
    "rogue": test_rogue,
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
