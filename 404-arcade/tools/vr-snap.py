"""
vr-snap.py — chụp nhanh các zone của Void Runner để soi visual.
Dùng lại CDP class từ voidrunner-qa.py. Chạy từ 404-arcade/:
  python3 tools/vr-snap.py
"""

import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("vq", os.path.join(HERE, "voidrunner-qa.py"))
vq = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vq)

BASE = vq.BASE
SHOTS = os.path.join(HERE, "vr-shots")


def main():
    c = vq.CDP()
    c.cmd("Page.enable")
    c.cmd("Runtime.enable")
    c.cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})

    c.cmd("Page.navigate", {"url": BASE})
    time.sleep(1.6)
    c.js("window.__ARCADE_VOIDRUNNER_TEST__ = true; true")
    if not vq.open_void_runner(c):
        print("FAIL: không mở được start screen")
        sys.exit(1)
    time.sleep(1.4)
    c.shot(f"{SHOTS}/snap-start.png")

    c.js(vq.sr("sr.querySelector('.vr-cta').click(); true"))
    time.sleep(0.8)

    # Zone 1: chạy một đoạn ngắn rồi chụp giữa track
    vq.key(c, "KeyW")
    time.sleep(0.9)
    vq.key(c, "KeyW", "keyup")
    time.sleep(0.5)
    c.shot(f"{SHOTS}/snap-zone1.png")

    # Các checkpoint: teleport + chụp
    for cp, name in [
        (2, "zone3-wallrun"),
        (3, "zone4-slide"),
        (4, "zone5-movers"),
        (6, "zone7-leap"),
        (7, "zone8-portal"),
    ]:
        c.js(f"window.__VR_DEBUG__.teleport({cp}); true")
        time.sleep(0.9)
        c.shot(f"{SHOTS}/snap-{name}.png")

    # Laser: đứng đầu zone 6 nhìn +Z — chụp 2 nhịp để bắt beam đang bật
    c.js("window.__VR_DEBUG__.place(-95, 0, -119, Math.PI); true")
    time.sleep(1.1)
    c.shot(f"{SHOTS}/snap-zone6-laser.png")
    time.sleep(1.35)
    c.shot(f"{SHOTS}/snap-zone6-laser2.png")

    print("Đã chụp xong vào", SHOTS)


if __name__ == "__main__":
    main()
