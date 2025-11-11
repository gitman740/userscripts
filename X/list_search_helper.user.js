// ==UserScript==
// @name         [X] list search helper
// @namespace    https://tampermonkey.net/
// @version      0.7.0
// @description  list:検索時にリプライをフィルタリング。自己リプライ保持／他人リプライ非表示を選択可能。詳細ログと結果ログを独立制御。
// @match        https://x.com/*
// @match        https://twitter.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
  "use strict";

  const TAG = "[list-replies-filter]";

  const CONFIG = {
    keepSelfReplies: true,   // 自己リプライ保持（デフォルト true）
    hideOtherReplies: true,  // 他人リプライ非表示（デフォルト true）
    hardHide: true,          // true: 完全非表示, false: 半透明で残す
    rescanIntervalMs: 2000,  // 定期再走査間隔

    // ログ制御
    debug: false,            // true: 詳細ログ（authorHandle, replyMentions 等）
    showResultLog: false,     // true: hide/keep結果を表示, false: 非表示
  };

  const LOG = {
    debug: (...args) => { if (CONFIG.debug) console.log(TAG, ...args); },
    result: (...args) => { if (CONFIG.showResultLog) console.log(TAG, ...args); },
    warn: (...args) => console.warn(TAG, ...args),
    error: (...args) => console.error(TAG, ...args),
  };

  LOG.debug("init");

  function isApplicablePage() {
    try {
      const url = new URL(window.location.href);
      const isSearch = url.pathname.includes("/search");
      const q = url.searchParams.get("q") || "";
      const hasListOperator = q.toLowerCase().includes("list:");
      LOG.debug("page check:", { pathname: url.pathname, isSearch, hasListOperator, q });
      return isSearch && hasListOperator;
    } catch (e) {
      LOG.error("URL parse failed", e);
      return false;
    }
  }

  if (!isApplicablePage()) {
    LOG.result("not a list: search page; observer not attached");
    return;
  }

  function leadingText(el) {
    if (!el) return "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        return String(node.textContent || "");
      }
    }
    return (el.innerText || "").trim();
  }

  function findReplyLabelDiv(article) {
    const candidates = article.querySelectorAll("div");
    for (const div of candidates) {
      const t = leadingText(div).trim();
      if (t === "返信先:") {
        return div;
      }
    }
    return null;
  }

  function extractAuthorId(article) {
    const userNameBlock = article.querySelector('div[data-testid="User-Name"]');
    if (!userNameBlock) return null;
    const statusLink = userNameBlock.querySelector('a[href*="/status/"]');
    if (!statusLink) return null;
    const href = statusLink.getAttribute("href") || "";
    const m = href.match(/^\/([^\/]+)\/status\//);
    return m ? "@" + m[1] : null;
  }

  function extractReplyIds(article) {
    const labelDiv = findReplyLabelDiv(article);
    if (!labelDiv) return { socialText: "", replyMentions: [] };
    const socialText = (labelDiv.innerText || "").trim();

    const links = labelDiv.querySelectorAll("a[href^='/']");
    const ids = Array.from(links).map(a => {
      const href = a.getAttribute("href") || "";
      const m = href.match(/^\/([^\/]+)/);
      return m ? "@" + m[1] : (a.textContent || "").trim();
    });

    return { socialText, replyMentions: ids };
  }

  function getTweetParts(article) {
    if (!article) return null;
    const cell = article.closest('div[data-testid="cellInnerDiv"]') || article;

    const authorHandle = extractAuthorId(article);
    const { socialText, replyMentions } = extractReplyIds(article);

    LOG.debug("authorHandle:", authorHandle);
    LOG.debug("replyMentions:", replyMentions);
    LOG.debug("socialText:", socialText);

    return { cell, authorHandle, socialText, replyMentions };
  }

  function shouldHide(article) {
    const parts = getTweetParts(article);
    if (!parts) return { hide: false, reason: "no-parts" };

    const { authorHandle, socialText, replyMentions } = parts;

    if (!socialText || replyMentions.length === 0) {
      return { hide: false, reason: "not-a-reply" };
    }

    const isSelfReply = !!authorHandle && replyMentions.some(r => r === authorHandle);

    if (isSelfReply) {
      if (CONFIG.keepSelfReplies) {
        return { hide: false, reason: "self-reply-kept" };
      } else {
        return { hide: true, reason: "self-reply-hidden" };
      }
    } else {
      if (CONFIG.hideOtherReplies) {
        return { hide: true, reason: "other-reply-hidden" };
      } else {
        return { hide: false, reason: "other-reply-kept" };
      }
    }
  }

  function hideCell(cell) {
    if (!cell) return;
    if (CONFIG.hardHide) {
      cell.style.display = "none";
      cell.setAttribute("aria-hidden", "true");
    } else {
      cell.style.opacity = "0.25";
      cell.style.pointerEvents = "none";
      cell.setAttribute("aria-hidden", "true");
    }
  }

  function processArticle(article) {
    const decision = shouldHide(article);
    const parts = getTweetParts(article);
    const cell = parts ? parts.cell : article;

    if (decision.hide) {
      hideCell(cell);
      LOG.result("hide", decision.reason);
    } else {
      LOG.result("keep", decision.reason);
    }
  }

  function scanAll() {
    const articles = document.querySelectorAll('article[role="article"]');
    LOG.debug("scan", { count: articles.length });
    articles.forEach(processArticle);
  }

  const observer = new MutationObserver(mutations => {
    let found = 0;
    for (const m of mutations) {
      for (const node of m.addedNodes || []) {
        if (!(node instanceof HTMLElement)) continue;

        if (node.matches && node.matches('article[role="article"]')) {
          found++;
          processArticle(node);
          continue;
        }

        const nested = node.querySelectorAll
          ? node.querySelectorAll('article[role="article"]')
          : [];
        if (nested.length) {
          found += nested.length;
          nested.forEach(processArticle);
        }
      }
    }
    LOG.debug("observer processed", { articlesFound: found });
  });

  function attachObserver() {
    const root = document.querySelector("#react-root") || document.body;
    observer.observe(root, { childList: true, subtree: true });
    LOG.result("observer attached");
  }

  function start() {
    attachObserver();
    scanAll();
    setInterval(scanAll, CONFIG.rescanIntervalMs);
    LOG.result("started");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
