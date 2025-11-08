// ==UserScript==
// @name         [YT]  Focus Skip Button 
// @match        https://www.youtube.com/*
// @run-at       document-idle
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

  function focusWithRetries(btn, attempts = 5) {
    let left = attempts;
    const tryFocus = () => {
      if (!isVisible(btn)) {
        if (--left > 0) requestAnimationFrame(tryFocus);
        return;
      }
      btn.tabIndex = 0;
      btn.focus({ preventScroll: true });
      if (document.activeElement !== btn && --left > 0) {
        requestAnimationFrame(tryFocus);
      }
    };
    tryFocus();
  }

  function handleSkipButton() {
    const btn = findSkipButton();
    if (btn) focusWithRetries(btn);
  }

  // 広告UIの出現に追従
  const mo = new MutationObserver(() => {
    handleSkipButton();
  });
  mo.observe(document.body, { childList: true, subtree: true });

  // 初期試行
  setTimeout(handleSkipButton, 1000);
})();
