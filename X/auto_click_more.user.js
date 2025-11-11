// ==UserScript==
// @name         [X] Auto Click more
// @namespace    http://tampermonkey.net/
// @description  Xの長い投稿の「さらに表示」を、テキストと親buttonで特定して自動クリックします
// @author       Grok
// @match        https://x.com/*
// @grant        none
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=x.com
// @updateURL    https://github.com/gitman740/userscripts/raw/refs/heads/main/X/auto_click_more.user.js
// @version      1.1.1
// ==/UserScript==

(function() {
    'use strict';

    // 「さらに表示」テキスト
    const targetText = 'さらに表示';

    // ボタンを探してクリックする関数
    function clickShowMore() {
        let clicked = false;

        // ページ内の全テキストノードを効率的に走査（querySelectorAllでspanなどを対象）
        const candidates = document.querySelectorAll('span, div, button'); // テキストを含む可能性が高い要素
        candidates.forEach(element => {
            if (element.innerText === targetText && element.offsetParent !== null) {
                // 親または祖先が<button>かを確認
                let parentButton = element.closest('button');
                if (parentButton && !parentButton.disabled) {
                    parentButton.click();
                    clicked = true;
                }
            }
        });

        return clicked;
    }

    // MutationObserverでDOM変更を監視
    const observer = new MutationObserver(() => {
        clickShowMore();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true // テキスト変更にも対応
    });

    // 初回実行（ページ読み込み後）
    setTimeout(clickShowMore, 1500);

    // バックアップ用定期実行（動的読み込み対応）
    const intervalId = setInterval(() => {
        if (clickShowMore()) {
            // クリックが発生したら短い待機を挿入（連続クリック防止）
            setTimeout(() => {}, 500);
        }
    }, 2500);

    // 必要に応じて停止（例: 100回実行後）
    // setTimeout(() => { clearInterval(intervalId); observer.disconnect(); }, 300000);

})();