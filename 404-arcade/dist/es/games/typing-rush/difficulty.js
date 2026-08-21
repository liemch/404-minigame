/**
 * difficulty.js — cấu hình độ khó Typing Rush 404.
 * fall: tốc độ rơi (đơn vị màn hình 0..1 mỗi giây) · spawnEvery: giây ·
 * maxTargets: số từ tối đa trên màn · adaptive: tự điều chỉnh ±(có trần).
 */

import { poolOf } from "./dictionary.js";

export const DIFFICULTIES = {
  easy: {
    id: "easy",
    label: "DỄ",
    fall: 0.042,
    spawnEvery: 3.0,
    maxTargets: 3,
    adaptive: false,
    lives: 3,
    allowBackspace: true,
    pool: () => poolOf("basic"),
  },
  normal: {
    id: "normal",
    label: "THƯỜNG",
    fall: 0.06,
    spawnEvery: 2.3,
    maxTargets: 4,
    adaptive: false,
    lives: 3,
    allowBackspace: true,
    pool: () => poolOf("basic", "technology"),
  },
  hard: {
    id: "hard",
    label: "KHÓ",
    fall: 0.082,
    spawnEvery: 1.7,
    maxTargets: 6,
    adaptive: false,
    lives: 3,
    allowBackspace: true,
    pool: () => poolOf("technology", "mixed"),
  },
  adaptive: {
    id: "adaptive",
    label: "THÍCH ỨNG",
    fall: 0.058,
    spawnEvery: 2.3,
    maxTargets: 5,
    adaptive: true,
    lives: 3,
    allowBackspace: true,
    pool: () => poolOf("basic", "technology", "mixed"),
  },
};

export function sessionConfig(diffId) {
  const d = DIFFICULTIES[diffId] || DIFFICULTIES.normal;
  return {
    fall: d.fall,
    spawnEvery: d.spawnEvery,
    maxTargets: d.maxTargets,
    adaptive: d.adaptive,
    lives: d.lives,
    allowBackspace: d.allowBackspace,
    wordPool: d.pool(),
  };
}
