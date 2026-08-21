/**
 * template.js — skeleton tĩnh của shadow DOM (markup tin cậy, không chứa
 * dữ liệu động; phần động luôn dựng bằng createElement/textContent).
 */

export const SPRITE_SVG = /* html */ `
<svg xmlns="http://www.w3.org/2000/svg" hidden aria-hidden="true">
  <symbol id="i-home" viewBox="0 0 24 24">
    <path fill="currentColor" d="M12 3 3 10.5h2.5V21H10v-5h4v5h4.5V10.5H21L12 3z"/>
  </symbol>
  <symbol id="i-sound-on" viewBox="0 0 24 24">
    <path fill="currentColor" d="M4 9v6h4l5 4.5v-15L8 9H4z"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.5 8.5a5 5 0 0 1 0 7"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6a8.5 8.5 0 0 1 0 12"/>
  </symbol>
  <symbol id="i-sound-off" viewBox="0 0 24 24">
    <path fill="currentColor" d="M4 9v6h4l5 4.5v-15L8 9H4z"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="m15.5 9.5 5 5m0-5-5 5"/>
  </symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path fill="currentColor" d="M7 4l13 8-13 8V4z"/></symbol>
  <symbol id="i-swap" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 8h14M14 4l4 4-4 4"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M21 16H7M10 12l-4 4 4 4"/>
  </symbol>
  <symbol id="i-restart" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M20 12a8 8 0 1 1-2.4-5.7"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20.5 3.5v4.2h-4.2"/>
  </symbol>
  <symbol id="i-close" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M5 5l14 14M19 5 5 19"/>
  </symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5l7 10H5l7-10z"/></symbol>
  <symbol id="i-gamepad" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      d="M6.5 7h11a4.5 4.5 0 0 1 4.4 5.5l-.8 3.6a2.8 2.8 0 0 1-4.9 1.2L14.6 15H9.4l-1.6 2.3a2.8 2.8 0 0 1-4.9-1.2l-.8-3.6A4.5 4.5 0 0 1 6.5 7z"/>
    <path fill="currentColor" d="M7 10h2v1.6h1.6v2H9v1.6H7v-1.6H5.4v-2H7V10z"/>
    <circle fill="currentColor" cx="16" cy="10.8" r="1.1"/>
    <circle fill="currentColor" cx="18.4" cy="13" r="1.1"/>
  </symbol>
  <symbol id="i-target" viewBox="0 0 24 24">
    <circle fill="none" stroke="currentColor" stroke-width="2" cx="12" cy="12" r="8"/>
    <circle fill="currentColor" cx="12" cy="12" r="2.4"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>
  </symbol>
  <symbol id="i-skull" viewBox="0 0 24 24">
    <path fill="currentColor" d="M12 2a8 8 0 0 0-8 8c0 2.9 1.6 5.4 4 6.8V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.2c2.4-1.4 4-3.9 4-6.8a8 8 0 0 0-8-8zm-3.4 9.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zm6.8 0a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6zM12 13l1.2 2.6h-2.4L12 13z"/>
  </symbol>
  <symbol id="i-chevrons" viewBox="0 0 24 24">
    <path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M5 17l7-6 7 6M5 11l7-6 7 6"/>
  </symbol>
  <symbol id="i-crosshair" viewBox="0 0 24 24">
    <circle fill="none" stroke="currentColor" stroke-width="2" cx="12" cy="12" r="7"/>
    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v5M12 17v5M2 12h5M17 12h5"/>
  </symbol>
  <symbol id="i-laurel-l" viewBox="0 0 24 48">
    <path fill="currentColor" d="M18 46c-8-3-13-10-13-19C5 15 12 6 21 2c-2 4-3 8-3 12 0-2-4-5-8-5 2 3 4 7 4 10 0-2-5-4-9-3 3 2 6 5 7 8-2-1-6-1-9 1 4 1 7 3 9 5-2 0-5 1-7 4 3 0 7 0 9 2-2 1-4 3-4 6 3-1 5-2 8-2v6z"/>
  </symbol>
  <symbol id="i-bullet" viewBox="0 0 10 22">
    <path fill="currentColor" d="M5 0c2 2 4 5 4 8v9H1V8c0-3 2-6 4-8z"/>
    <rect fill="currentColor" x="1" y="19" width="8" height="3" rx="1"/>
  </symbol>
  <symbol id="i-mouse" viewBox="0 0 24 32">
    <rect fill="none" stroke="currentColor" stroke-width="2" x="3" y="2" width="18" height="28" rx="9"/>
    <path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v10M3 12h18"/>
  </symbol>
  <symbol id="i-mouse-left" viewBox="0 0 24 32">
    <rect fill="none" stroke="currentColor" stroke-width="2" x="3" y="2" width="18" height="28" rx="9"/>
    <path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v10M3 12h18"/>
    <path fill="currentColor" opacity="0.9" d="M12 3.5V11H4.5V11A8.5 8.5 0 0 1 12 3.5z"/>
  </symbol>
  <symbol id="i-mouse-right" viewBox="0 0 24 32">
    <rect fill="none" stroke="currentColor" stroke-width="2" x="3" y="2" width="18" height="28" rx="9"/>
    <path fill="none" stroke="currentColor" stroke-width="2" d="M12 2v10M3 12h18"/>
    <path fill="currentColor" opacity="0.9" d="M12 3.5V11h7.5V11A8.5 8.5 0 0 0 12 3.5z"/>
  </symbol>
</svg>
`;

export const ROOT_HTML = /* html */ `
${SPRITE_SVG}
<div class="root">
  <div class="fx-stars" aria-hidden="true"></div>
  <div class="fx-scanlines" aria-hidden="true"></div>

  <header class="topbar">
    <span class="topbar-chip" aria-hidden="true"><i class="chip-px"></i>404-arcade.local</span>
    <div class="topbar-actions">
      <a class="btn btn-small" data-home-link href="/">
        <svg class="icon" aria-hidden="true"><use href="#i-home"></use></svg>
        <span data-ref="homeLabelTop">Về trang chủ</span>
      </a>
      <button type="button" class="icon-btn" data-sound-toggle aria-label="Bật hoặc tắt âm thanh" aria-pressed="false">
        <svg class="icon" aria-hidden="true"><use href="#i-sound-on"></use></svg>
      </button>
    </div>
  </header>

  <main class="page">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-logo" data-ref="logo"></div>
      <div class="hero-copy">
        <p class="hero-kicker">LỖI 404 — KHÔNG TÌM THẤY TRANG<span class="kicker-cursor" aria-hidden="true"></span></p>
        <h1 id="hero-title">Bạn vừa đi ra ngoài bản đồ</h1>
        <p class="hero-lead">Trang bạn tìm kiếm không tồn tại hoặc đã bị dịch chuyển sang một chiều không gian khác. Chọn một trò chơi để tiếp tục hành trình!</p>
        <div class="hero-actions">
          <a class="btn btn-solid" data-home-link href="/">
            <svg class="icon" aria-hidden="true"><use href="#i-home"></use></svg>
            <span data-ref="homeLabelHero">Về trang chủ</span>
          </a>
          <button type="button" class="btn" data-ref="scrollGames">Chọn trò chơi</button>
        </div>
      </div>
    </section>

    <section class="games" aria-label="Danh sách trò chơi">
      <h2 class="section-title"><i class="title-px" aria-hidden="true"></i><span>Chọn trò chơi</span><i class="title-px" aria-hidden="true"></i></h2>
      <div class="card-grid" data-ref="grid"></div>
    </section>
  </main>

  <footer class="footer">
    <p>Mẹo: nhấn <kbd>Esc</kbd> để thoát game · <kbd>P</kbd> để tạm dừng</p>
    <p class="footer-sub">404 ARCADE — không tìm thấy trang, nhưng tìm thấy niềm vui.</p>
  </footer>

  <div class="stage-backdrop" data-ref="stage" hidden>
    <section class="game-window" role="dialog" aria-modal="true" aria-label="Cửa sổ trò chơi" data-accent="cyan">
      <header class="window-bar">
        <span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
        <h2 class="window-title" data-ref="stageTitle">Trò chơi</h2>
        <div class="window-actions">
          <button type="button" class="bar-btn" data-ref="btnPause" disabled>
            <svg class="icon" aria-hidden="true"><use href="#i-pause"></use></svg>
            <span class="bar-label" data-ref="btnPauseLabel">Tạm dừng</span>
          </button>
          <button type="button" class="bar-btn icon-only" data-sound-toggle aria-label="Bật hoặc tắt âm thanh" aria-pressed="false">
            <svg class="icon" aria-hidden="true"><use href="#i-sound-on"></use></svg>
          </button>
          <button type="button" class="bar-btn" data-ref="btnSwitch">
            <svg class="icon" aria-hidden="true"><use href="#i-swap"></use></svg>
            <span class="bar-label">Đổi game</span>
          </button>
          <a class="bar-btn icon-only" data-home-link href="/" aria-label="Về trang chủ">
            <svg class="icon" aria-hidden="true"><use href="#i-home"></use></svg>
          </a>
        </div>
      </header>
      <div class="window-body">
        <div class="game-surface" data-ref="surface"></div>
        <aside class="game-hud" data-ref="hud" aria-label="Bảng điểm"></aside>
        <div class="stage-overlay" data-ref="overlay" hidden></div>
      </div>
    </section>
  </div>
</div>
`;
