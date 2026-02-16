// ==UserScript==
// @name         [GameDeveloper] Article Bookmark
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Adds a bookmark feature
// @author       You / Gemini
// @match        https://www.gamedeveloper.com/*
// @grant        GM_addStyle
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function() {
    'use strict';

    // しおりの保存キー。記事ごとにユニークにするためパス名を含める
    const BOOKMARK_KEY = "gamedeveloper_bookmark_" + location.pathname;

    // UIパネルのスタイルを定義
    GM_addStyle(`
        #gamedeveloper-bookmark-panel {
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
        #gamedeveloper-bookmark-panel:hover {
            opacity: 1.0;
            background: rgba(255, 255, 255, 1);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .gamedeveloper-btn {
            cursor: pointer;
            padding: 4px 10px;
            border: 1px solid #ddd;
            background-color: #f9f9f9;
            border-radius: 4px;
            font-size: 12px;
            color: #333;
            transition: background-color 0.2s;
        }
        .gamedeveloper-btn:hover {
            background-color: #f0f0f0;
        }
        #gamedeveloper-bookmark-msg {
            font-size: 11px;
            color: #00796b; /* 少し落ち着いた緑色 */
            text-align: center;
            display: none;
        }
    `);

    // UIパネルのHTML
    const panelHtml = `
        <div id="gamedeveloper-bookmark-panel">
            <div style="font-weight: 600; text-align: center; font-size: 13px; color: #555;">しおり</div>
            <button id="gamedeveloper-load-btn" class="gamedeveloper-btn" title="保存した位置へ移動">移動</button>
            <button id="gamedeveloper-save-btn" class="gamedeveloper-btn" title="現在の位置を保存">保存</button>
            <span id="gamedeveloper-bookmark-msg">保存完了</span>
        </div>
    `;

    // ヘッダー要素が見つかるまで待機して挿入
    const mountInterval = setInterval(() => {
        const $header = $('#navigation-header');
        if ($header.length) {
            clearInterval(mountInterval);

            // パネルをbodyに追加
            $('body').append(panelHtml);
            const $panel = $('#gamedeveloper-bookmark-panel');

            // パネルの位置をヘッダーに合わせて調整する関数
            const updatePanelPosition = () => {
                // ヘッダー(#navigation-header)の高さを考慮してオフセットを計算
                const headerHeight = $header.outerHeight();
                const HEADER_OFFSET = headerHeight + 20; // ヘッダーの高さ + 余白

                // X方向: 画面左端から固定
                $panel.css('left', '20px');

                // Y方向: ヘッダーの下に固定
                $panel.css('top', `${HEADER_OFFSET}px`);
            };

            // 初期位置設定＆スクロール・リサイズ時に追従
            updatePanelPosition();
            $(window).on('scroll resize', updatePanelPosition);

            // イベントハンドラをセットアップ
            setupEvents();

            // 保存されたしおりがあれば自動でロード
            if (localStorage.getItem(BOOKMARK_KEY)) {
                setTimeout(() => {
                    $('#gamedeveloper-load-btn').click();
                }, 500);
            }
        }
    }, 500);

    function setupEvents() {
        $('#gamedeveloper-save-btn').on('click', function() {
            const scrollPosition = { top: $(window).scrollTop(), left: $(window).scrollLeft() };
            localStorage.setItem(BOOKMARK_KEY, JSON.stringify(scrollPosition));
            $('#gamedeveloper-bookmark-msg').fadeIn(300).delay(1500).fadeOut(500);
        });

        // 「移動」ボタンのクリックイベント
        $('#gamedeveloper-load-btn').on('click', function() {
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