// ==UserScript==
// @name         [YT]  Focus Skip Button
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @updateURL    https://github.com/gitman740/userscripts/raw/refs/heads/main/YouTube/focus_skip_button.user.js
// @version      0.1.2
// ==/UserScript==

(function() {
  const selectors = [
    '.ytp-ad-skip-button',
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button-modern'
  ];

  function findSkipButton() {
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn) return btn;
    }
    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (el.offsetParent === null) return false;
    return true;
  }

  function focusWithRetries(btn, attempts = 10) {
    let left = attempts;
    const tryFocus = () => {
      if (!isVisible(btn)) {
        if (--left > 0) requestAnimationFrame(tryFocus);
        return;
      }
      btn.tabIndex = 0;
      btn.focus({ preventScroll: true });
      btn.style.outline = '4px solid #ffeb3b';
      btn.style.outlineOffset = '2px';
      console.log('[skip-focus] フォーカス試行 残り:', left, 'activeElement===btn?', document.activeElement === btn);
      if (document.activeElement !== btn && --left > 0) {
        requestAnimationFrame(tryFocus);
      }
    };
    tryFocus();
  }

  function watchButton(btn) {
    // すでに可視ならリトライ付きでフォーカス
    if (isVisible(btn)) {
      focusWithRetries(btn);
      return;
    }
    // 属性変化を監視して、可視化された瞬間にリトライ付きフォーカス
    const obs = new MutationObserver(() => {
      if (isVisible(btn)) {
        obs.disconnect();
        focusWithRetries(btn);
      }
    });
    obs.observe(btn, { attributes: true, attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'] });
  }

  function handleSkipButton() {
    const btn = findSkipButton();
    if (btn) watchButton(btn);
  }

  // 広告UIの出現を監視
  const mo = new MutationObserver(() => {
    handleSkipButton();
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // 初期試行
  setTimeout(handleSkipButton, 1000);
})();
