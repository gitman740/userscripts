// ==UserScript==
// @name         [Medium] Article Bookmark
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  Adds a bookmark feature to Medium articles, placed in the bottom-right corner.
// @author       You / Gemini
// @match        https://medium.com/*/*
// @match        https://*.medium.com/*
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function() {
    'use strict';

    // しおりの保存キー。記事ごとにユニークにするためパス名を含める
    const BOOKMARK_KEY = "medium_article_bookmark_" + location.pathname;

    // UIパネルのスタイルを定義
    GM_addStyle(`
        #medium-bookmark-panel {
            position: fixed; /* スクロールに追従するよう変更 */
            /* top, left の値はJavaScriptで動的に設定 */
            z-index: 9999;
            background: rgba(255, 255, 255, 0.8);
            padding: 8px 12px;
            border: 1px solid #ccc;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            opacity: 0.3;
            transition: opacity 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        #medium-bookmark-panel:hover {
            opacity: 1.0;
            background: rgba(255, 255, 255, 1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .medium-btn {
            cursor: pointer;
            padding: 4px 10px;
            border: 1px solid #ddd;
            background-color: #f9f9f9;
            border-radius: 4px;
            font-size: 12px;
            color: #333;
            transition: background-color 0.2s;
        }
        .medium-btn:hover {
            background-color: #f0f0f0;
        }
        #medium-bookmark-msg {
            font-size: 11px;
            color: #00796b; /* 少し落ち着いた緑色 */
            text-align: center;
            display: none;
        }
    `);

    // UIパネルのHTML
    const panelHtml = `
        <div id="medium-bookmark-panel">
            <div style="font-weight: 600; text-align: center; font-size: 13px; color: #555;">しおり</div>
            <button id="medium-load-btn" class="medium-btn" title="保存した位置へ移動">移動</button>
            <button id="medium-save-btn" class="medium-btn" title="現在の位置を保存">保存</button>
            <span id="medium-bookmark-msg">保存完了</span>
        </div>
    `;

    // article要素が見つかるまで待機して挿入
    const mountInterval = setInterval(() => {
        const $article = $('article').first();
        if ($article.length) {
            clearInterval(mountInterval);

            // パネルをbodyに追加
            $('body').append(panelHtml);
            const $panel = $('#medium-bookmark-panel');

            // パネルの位置を記事に合わせて調整する関数
            const updatePanelPosition = () => {
                const rect = $article[0].getBoundingClientRect();
                const panelHeight = $panel.outerHeight();
                const HEADER_OFFSET = 80; // ヘッダーの高さ分を確保

                // X方向: 記事の左端から少し内側 (fixedなのでviewport基準のrect.leftを使用)
                $panel.css('left', `${rect.left + 15}px`);

                // Y方向: 記事領域内に収まるように計算
                // 1. 基本は記事の開始位置 + 余白
                let top = rect.top + 20;

                // 2. ヘッダーより上に行かないように制限 (Sticky動作)
                if (top < HEADER_OFFSET) {
                    top = HEADER_OFFSET;
                }

                // 3. 記事の末尾を超えないように制限
                if (top + panelHeight > rect.bottom) {
                    top = rect.bottom - panelHeight;
                }

                $panel.css('top', `${top}px`);
            };

            // 初期位置設定＆スクロール・リサイズ時に追従
            updatePanelPosition();
            $(window).on('scroll resize', updatePanelPosition);

            // イベントハンドラをセットアップ
            setupEvents();

            // 保存されたしおりがあれば自動でロード
            if (localStorage.getItem(BOOKMARK_KEY)) {
                setTimeout(() => {
                    $('#medium-load-btn').click();
                }, 500);
            }
        }
    }, 500);

    function setupEvents() {
        $('#medium-save-btn').on('click', function() {
            const scrollPosition = { top: $(window).scrollTop(), left: $(window).scrollLeft() };
            localStorage.setItem(BOOKMARK_KEY, JSON.stringify(scrollPosition));
            $('#medium-bookmark-msg').fadeIn(300).delay(1500).fadeOut(500);
        });

        // 「移動」ボタンのクリックイベント
        $('#medium-load-btn').on('click', function() {
            const savedPosition = localStorage.getItem(BOOKMARK_KEY);
            if (savedPosition) {
                const pos = JSON.parse(savedPosition);
                $('html, body').animate({ scrollTop: pos.top, scrollLeft: pos.left }, 500, 'swing'); // スムーズスクロール
            } else {
                alert("保存されているしおりはありません。");
            }
        });
    }
})();