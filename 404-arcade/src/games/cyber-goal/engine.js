/**
 * engine.js — luật Cyber Goal 404: shootout đá luân lưu vs CPU.
 *
 * Shot model 2.5D: bóng bay từ chấm phạt đền tới điểm ngắm trên mặt
 * phẳng khung thành (x/y màn hình + tiến trình k, scale thu nhỏ dần);
 * gravity/curve/gió chỉ là offset hình ảnh — KẾT QUẢ được tính tất định
 * ngay lúc sút từ (điểm ngắm + power + spin + gió + AI thủ môn).
 * Thủ môn KHÔNG đọc input: đoán vùng theo xác suất + lịch sử sút của
 * người chơi + difficulty (config bên dưới).
 */

/** Hình học thế giới 1600×900 (đồng bộ với render). */
export const WORLD = { w: 1600, h: 900 };

export const GOAL = {
  cx: 800,
  left: 445, // mép trong cột trái
  right: 1155,
  bar: 210, // mép dưới xà
  ground: 555, // vạch cầu môn
};

export const SPOT = { x: 800, y: 735 };

/** 5 vùng mục tiêu trong khung thành (tâm vẽ vòng ngắm). */
export const ZONES = {
  LH: { x: 560, y: 300 },
  RH: { x: 1040, y: 300 },
  LL: { x: 560, y: 470 },
  RL: { x: 1040, y: 470 },
  C: { x: 800, y: 400 },
};

/** Cấu hình 3 difficulty theo plan (reach/reaction/gió nằm ở đây). */
export const DIFFS = {
  easy: { label: "DỄ", keeperGuess: 0.34, ourKeeper: 0.62, cpuMiss: 0.3, wind: 0, telegraph: true },
  normal: { label: "CHUẨN", keeperGuess: 0.5, ourKeeper: 0.5, cpuMiss: 0.2, wind: 0.5, telegraph: false },
  hard: { label: "KHÓ", keeperGuess: 0.64, ourKeeper: 0.38, cpuMiss: 0.12, wind: 1, telegraph: false },
};

export const KICKS_TOTAL = 10; // 5 lượt mỗi bên

export function zoneOf(x, y) {
  const col = x < 660 ? "L" : x > 940 ? "R" : "C";
  if (col === "C") return "C";
  return col + (y < 385 ? "H" : "L");
}

export function rollWind(diffKey) {
  const max = DIFFS[diffKey].wind;
  if (max === 0) return 0;
  const v = (Math.random() * 2 - 1) * max;
  return Math.round(v * 10) / 10;
}

export function createMatch(diffKey) {
  return {
    diff: diffKey,
    cfg: DIFFS[diffKey],
    kicks: 0, // tổng cú đá đã thực hiện (cả 2 bên)
    playerGoals: 0,
    cpuGoals: 0,
    turn: "player", // player | cpu
    phase: "aim", // aim | flight | result
    wind: rollWind(diffKey),
    combo: 0,
    maxCombo: 0,
    score: 0,
    goals: 0,
    saves: 0, // số lần thủ môn phe ta cản được
    history: { LH: 0, RH: 0, LL: 0, RL: 0, C: 0 },
    keeper: { zone: "C", t: 0, diving: false, lean: 0 },
    preZone: null, // telegraph (Easy): vùng dive chọn trước khi người chơi sút
    flight: null,
    suddenDeath: false,
    over: false,
    events: [],
  };
}

export function drainEvents(m) {
  const ev = m.events;
  m.events = [];
  return ev;
}

/**
 * Vị trí bóng trong không gian màn hình theo tiến trình bay:
 * lerp tới điểm chạm + vòng cung trọng lực + độ cong spin, scale nhỏ dần.
 */
export function flightPos(f) {
  const k = Math.min(1, f.t / f.dur);
  const arc = 150 * (1 - f.power * 0.5);
  const x = f.sx + (f.tx - f.sx) * k + f.spin * 120 * Math.sin(Math.PI * k);
  const y = f.sy + (f.ty - f.sy) * k - arc * Math.sin(Math.PI * k);
  return { x, y, scale: 1 - 0.62 * k, k };
}

/** AI thủ môn đối phương: xác suất + lịch sử, không đọc cú sút hiện tại. */
function keeperPick(m) {
  const zones = Object.keys(ZONES);
  const hist = m.history;
  const total = zones.reduce((s, z) => s + hist[z], 0);
  // vùng người chơi hay sút nhất
  let fav = "C";
  let best = -1;
  for (const z of zones) {
    if (hist[z] > best) {
      best = hist[z];
      fav = z;
    }
  }
  const guessFav = m.cfg.keeperGuess + (total >= 3 ? 0.12 : 0);
  if (Math.random() < guessFav && total > 0) return fav;
  return zones[Math.floor(Math.random() * zones.length)];
}

/** Kiểm tra chạm cột/xà: trả 'post' | null. */
function postCheck(x, y) {
  const nearL = Math.abs(x - GOAL.left) < 24;
  const nearR = Math.abs(x - GOAL.right) < 24;
  const nearBar = Math.abs(y - GOAL.bar) < 22 && x > GOAL.left - 24 && x < GOAL.right + 24;
  if (nearBar) return "post";
  if ((nearL || nearR) && y > GOAL.bar - 22 && y < GOAL.ground) return "post";
  return null;
}

/**
 * Người chơi sút. aim = {tx, ty, power(0..1), spin(-1..1)}.
 * Kết quả tất định theo input + gió + vùng thủ môn đã chọn.
 */
export function playerShoot(m, aim) {
  if (m.over || m.turn !== "player" || m.phase !== "aim") return false;
  // gió + spin đẩy điểm chạm cuối (nhìn thấy được trên quỹ đạo)
  const tx = aim.tx + m.wind * 90 + aim.spin * 60;
  const ty = aim.ty + (1 - aim.power) * 40; // sút yếu → bóng chìm xuống
  const zone = zoneOf(tx, ty);
  m.history[zone] += 1;

  // telegraph ở Easy: thủ môn đã "nghiêng người" từ trước → dùng vùng đó
  const keeperZone = m.preZone || keeperPick(m);
  m.preZone = null;
  const post = postCheck(tx, ty);
  const inGoal =
    !post && tx > GOAL.left + 18 && tx < GOAL.right - 18 && ty > GOAL.bar + 16 && ty < GOAL.ground - 6;

  let outcome;
  if (post) outcome = "post";
  else if (!inGoal) outcome = "miss";
  else if (keeperZone === zone) {
    // đoán đúng vùng: chỉ thua khi sút cực mạnh vào sát góc
    const cornerDist = Math.hypot(tx - GOAL.cx, ty - (GOAL.bar + GOAL.ground) / 2);
    outcome = aim.power > 0.86 && cornerDist > 300 ? "goal" : "save";
  } else if (zone === "C" && aim.power < 0.45) {
    outcome = "save"; // sút nhẹ vào giữa: thủ môn kịp thu chân
  } else {
    outcome = "goal";
  }

  m.phase = "flight";
  m.kicks += 1;
  m.keeper = { zone: keeperZone, t: 0, diving: true, lean: 0 };
  m.flight = {
    who: "player",
    sx: SPOT.x,
    sy: SPOT.y,
    tx,
    ty,
    spin: aim.spin,
    power: aim.power,
    dur: 0.9 - aim.power * 0.42,
    t: 0,
    outcome,
    done: false,
  };
  m.events.push({ type: "kick", who: "player" });
  return true;
}

/** CPU sút (tự động): thủ môn phe ta auto đoán theo config. */
function cpuShoot(m) {
  const zones = Object.keys(ZONES);
  const zone = zones[Math.floor(Math.random() * zones.length)];
  const zc = ZONES[zone];
  const spread = 46;
  const tx = zc.x + (Math.random() * 2 - 1) * spread;
  const ty = zc.y + (Math.random() * 2 - 1) * spread;
  const power = 0.55 + Math.random() * 0.4;

  const ourGuess = Math.random() < m.cfg.ourKeeper ? zone : zones[Math.floor(Math.random() * zones.length)];
  let outcome;
  if (Math.random() < m.cfg.cpuMiss) outcome = Math.random() < 0.4 ? "post" : "miss";
  else if (ourGuess === zone) outcome = "save";
  else outcome = "goal";

  // cú sút hỏng bay chệch hẳn ra ngoài
  let fx = tx;
  let fy = ty;
  if (outcome === "miss") {
    fx = tx < GOAL.cx ? GOAL.left - 90 : GOAL.right + 90;
    fy = GOAL.bar + 40;
  } else if (outcome === "post") {
    fx = tx < GOAL.cx ? GOAL.left : GOAL.right;
    fy = GOAL.bar + 60;
  }

  m.phase = "flight";
  m.kicks += 1;
  m.keeper = { zone: ourGuess, t: 0, diving: true, lean: 0 };
  m.flight = {
    who: "cpu",
    sx: SPOT.x,
    sy: SPOT.y,
    tx: fx,
    ty: fy,
    spin: 0,
    power,
    dur: 0.9 - power * 0.42,
    t: 0,
    outcome,
    done: false,
  };
  m.events.push({ type: "kick", who: "cpu" });
}

/** Kết thúc một cú đá: cập nhật tỷ số/điểm, kiểm tra hết trận. */
function resolveFlight(m) {
  const f = m.flight;
  f.done = true;
  m.phase = "result";
  m.resultT = 1.45;

  if (f.who === "player") {
    if (f.outcome === "goal") {
      m.playerGoals += 1;
      m.goals += 1;
      m.combo += 1;
      m.maxCombo = Math.max(m.maxCombo, m.combo);
      let pts = 100 * m.combo;
      // thưởng vùng mục tiêu: chạm gần tâm 1 trong 4 vòng góc
      for (const z of ["LH", "RH", "LL", "RL"]) {
        if (Math.hypot(f.tx - ZONES[z].x, f.ty - ZONES[z].y) < 80) {
          pts += 50;
          m.events.push({ type: "ringHit", zone: z });
          break;
        }
      }
      m.score += pts;
      m.events.push({ type: "goal", who: "player", pts });
    } else {
      m.combo = 0;
      m.events.push({ type: f.outcome, who: "player" });
    }
  } else {
    if (f.outcome === "goal") {
      m.cpuGoals += 1;
      m.events.push({ type: "goal", who: "cpu" });
    } else {
      if (f.outcome === "save") {
        m.saves += 1;
        m.score += 75;
      }
      m.events.push({ type: f.outcome, who: "cpu" });
    }
  }
}

/** Chuyển lượt sau màn kết quả; xử lý sudden death. */
function nextKick(m) {
  m.flight = null;
  m.keeper = { zone: "C", t: 0, diving: false, lean: 0 };
  m.wind = rollWind(m.diff);

  const pairDone = m.kicks % 2 === 0;
  if (pairDone) {
    if (m.kicks >= KICKS_TOTAL) {
      if (m.playerGoals !== m.cpuGoals) {
        finish(m);
        return;
      }
      if (!m.suddenDeath) {
        m.suddenDeath = true;
        m.events.push({ type: "suddenDeath" });
      } else {
        // trong sudden death: mỗi cặp đá quyết định luôn nếu lệch
        finishIfDecided(m);
        if (m.over) return;
      }
    } else if (m.suddenDeath) {
      finishIfDecided(m);
      if (m.over) return;
    }
  }

  m.turn = m.turn === "player" ? "cpu" : "player";
  m.phase = "aim";
  if (m.turn === "cpu") {
    m.cpuDelay = 1.0; // nghỉ ngắn rồi CPU tự sút
  }
}

function finishIfDecided(m) {
  if (m.playerGoals !== m.cpuGoals) finish(m);
}

function finish(m) {
  m.over = true;
  const win = m.playerGoals > m.cpuGoals;
  if (win) m.score += m.suddenDeath ? 750 : 500;
  m.events.push({ type: "over", win });
}

export function stepMatch(m, dt) {
  if (m.over) return;
  if (m.phase === "flight" && m.flight) {
    m.flight.t += dt;
    if (m.keeper.diving) m.keeper.t = Math.min(1, m.keeper.t + dt / (m.flight.dur * 0.9));
    if (m.flight.t >= m.flight.dur && !m.flight.done) resolveFlight(m);
  } else if (m.phase === "result") {
    m.resultT -= dt;
    if (m.keeper.diving) m.keeper.t = Math.min(1, m.keeper.t + dt * 2);
    if (m.resultT <= 0) nextKick(m);
  } else if (m.phase === "aim" && m.turn === "cpu") {
    m.cpuDelay -= dt;
    if (m.cpuDelay <= 0) cpuShoot(m);
  } else if (m.phase === "aim" && m.turn === "player" && m.cfg.telegraph && !m.preZone) {
    // telegraph nhẹ ở Easy: chọn trước vùng dive + nghiêng người lộ hướng
    m.preZone = keeperPick(m);
    m.keeper.lean = ZONES[m.preZone].x < GOAL.cx ? -1 : ZONES[m.preZone].x > GOAL.cx ? 1 : 0;
  }
}
