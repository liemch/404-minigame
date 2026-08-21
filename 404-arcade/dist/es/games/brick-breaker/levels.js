/**
 * levels.js — 10 màn Brick Breaker 404 (module JS thuần, không .json).
 * Ký hiệu: '.' trống · N gạch thường · R tăng cường (2 hit) ·
 * E gạch nổ (phá lan 8 ô) · U bất hoại.
 * Màn 04 tái tạo bố cục "404" trong ảnh reference.
 */

export const LEVELS = [
  {
    id: 1,
    name: "KHỞI ĐỘNG",
    ballSpeed: 360,
    powerupChance: 0.16,
    rows: [
      "NNNNNNNNNNN",
      "NNNNNNNNNNN",
      "NNNRNNNRNNN",
      "NNNNNNNNNNN",
    ],
  },
  {
    id: 2,
    name: "SÓNG ĐÔI",
    ballSpeed: 380,
    powerupChance: 0.15,
    rows: [
      "NNNNNNNNNNNN",
      "RN.NR..RN.NR",
      "NNNNNNNNNNNN",
      ".E.N.NN.N.E.",
    ],
  },
  {
    id: 3,
    name: "KIM TỰ THÁP",
    ballSpeed: 400,
    powerupChance: 0.14,
    rows: [
      "......N......",
      ".....NRN.....",
      "....NNRNN....",
      "...NNNENNN...",
      "..NNNNRNNNN..",
      ".NNNNNNNNNNN.",
    ],
  },
  {
    id: 4,
    name: "BỨC TƯỜNG 404",
    ballSpeed: 420,
    powerupChance: 0.12,
    rows: [
      "UUUUUUUUUUUUUU",
      "N..N.RNNR.N..N",
      "E..N.N..N.N..E",
      "NNNN.N..N.NNNN",
      "...N.E..E.N...",
      "...N.NNNN.N...",
    ],
  },
  {
    id: 5,
    name: "LÒ PHẢN ỨNG",
    ballSpeed: 440,
    powerupChance: 0.12,
    rows: [
      "U.NNNNNNNN.U",
      ".NNNEEEENNN.",
      ".NNEERREENN.",
      ".NNNEEEENNN.",
      "U.NNNNNNNN.U",
    ],
  },
  {
    id: 6,
    name: "PHÁO ĐÀI",
    ballSpeed: 460,
    powerupChance: 0.11,
    rows: [
      "UNNNNNNNNNNNNU",
      "N.RRN.EE.NRR.N",
      "N.NNN.NN.NNN.N",
      "U.RNR.EE.RNR.U",
      "NNNNNNNNNNNNNN",
    ],
  },
  {
    id: 7,
    name: "BÀN CỜ",
    ballSpeed: 480,
    powerupChance: 0.11,
    rows: [
      "N.R.N.E.N.R.N",
      ".N.N.N.N.N.N.",
      "R.N.E.N.E.N.R",
      ".N.N.N.N.N.N.",
      "N.E.N.R.N.E.N",
      ".N.N.N.N.N.N.",
    ],
  },
  {
    id: 8,
    name: "HẺM NÚI",
    ballSpeed: 500,
    powerupChance: 0.11,
    rows: [
      "NNNNNU..UNNNNN",
      "RNNNNU..UNNNNR",
      "NNNNNU..UNNNNN",
      "ENNNNU..UNNNNE",
      "NNNNN....NNNNN",
      "......RR......",
      "NNNN.NEEN.NNNN",
    ],
  },
  {
    id: 9,
    name: "TỔ ONG",
    ballSpeed: 520,
    powerupChance: 0.1,
    rows: [
      "NNENNENNENNENN",
      "NRNNRNNRNNRNNR",
      "NNNNNNNNNNNNNN",
      "ENNEENNEENNEEN",
      "NNNNNNNNNNNNNN",
    ],
  },
  {
    id: 10,
    name: "TRÙM CUỐI",
    ballSpeed: 540,
    powerupChance: 0.1,
    rows: [
      "UUUUUUUUUUUUUU",
      "RRNNEENNEENNRR",
      "NNRNNRNNRNNRNN",
      "ENNNENNNENNNEN",
      "NRNNNRNNNRNNRN",
      "NNNNNNNNNNNNNN",
      "U..U..UU..U..U",
    ],
  },
];
