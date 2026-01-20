// ==UserScript==
// @name         青空文庫表示制御
// @namespace    https://greasyfork.org/ja/users/219984-isari
// @version      0.3.1
// @description  青空文庫のフォントや文字サイズ、背景色、本文幅(px)を変更し、設定を保存して次回復元します
// @author       isari
// @author       Gemini
// @license      MIT
// @match        https://www.aozora.gr.jp/cards/*/files/*
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @require      https://unpkg.com/huebee@1/dist/huebee.pkgd.min.js
// @resource     HueBeeCSS https://unpkg.com/huebee@1/dist/huebee.min.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

$(function() {
    'use strict';

    const FONTS = [
        'メイリオ', '游ゴシック', 'ヒラギノ角ゴ ProN', 'IPAゴシック',
        'ＭＳ　Ｐゴシック', '游明朝', 'ヒラギノ明朝 ProN', 'IPA明朝', 'ＭＳ Ｐ明朝'
    ];
    const SIZES = ["large", "unset", "small"];
    const HEIGHTS = ["200%", "150%", "130%"];

    // ▼ UI パネル
    $('.main_text').before(`
<select id="font"><option value="">--フォント--</option></select>
<select id="font-size"><option value="">--文字サイズ--</option>
<option value=${SIZES[0]}>大</option>
<option value=${SIZES[1]}>中</option>
<option value=${SIZES[2]}>小</option></select>
<select id="line-height"><option value="">--行間--</option>
<option value=${HEIGHTS[0]}>大</option>
<option value=${HEIGHTS[1]}>中</option>
<option value=${HEIGHTS[2]}>小</option></select>
<input id="color" name="color" type="text" value="#FFFFFF">
<input id="text-width" type="number" min="100" placeholder="幅(px)">
`);

    // ▼ 設定保存・読み込み用キー
    const KEY = "aozora_settings";

    // ▼ 設定を保存
    function saveSettings() {
        const data = {
            font: $('#font').val(),
            fontSize: $('#font-size').val(),
            lineHeight: $('#line-height').val(),
            color: $('#color').val(),
            width: $('#text-width').val()
        };
        localStorage.setItem(KEY, JSON.stringify(data));
    }

    // ▼ 設定を適用
    function applySettings(data) {
        if (!data) return;

        if (data.font) {
            $('#font').val(data.font);
            $('body').css('font-family', `"${data.font}"`);
        }
        if (data.fontSize) {
            $('#font-size').val(data.fontSize);
            $('body').css('font-size', data.fontSize);
        }
        if (data.lineHeight) {
            $('#line-height').val(data.lineHeight);
            $('div').css('line-height', data.lineHeight);
        }
        if (data.width) {
            $('#text-width').val(data.width);
            $('.main_text').css('width', data.width + 'px');
        }
        if (data.color) {
            hueb.setColor(data.color);
        }
    }

    // ▼ フォント選択
    const $font = $('#font');
    for (let i = 0; i < FONTS.length; i++) {
        $font.append($('<option>').val(FONTS[i]).text(FONTS[i]));
    }
    $font.on('change', function() {
        $('body').css('font-family', `"${$(this).val()}"`);
        saveSettings();
    });

    // ▼ 文字サイズ
    $('#font-size').on('change', function() {
        $('body').css('font-size', $(this).val());
        saveSettings();
    });

    // ▼ 行間
    $('#line-height').on('change', function() {
        $('div').css('line-height', $(this).val());
        saveSettings();
    });

    // ▼ 幅(px)
    $('#text-width').on('input', function() {
        const w = $(this).val();
        if (w && !isNaN(w)) {
            $('.main_text').css('width', w + 'px');
        }
        saveSettings();
    });

    // ▼ HueBee カラーピッカー
    var css = GM_getResourceText("HueBeeCSS");
    GM_addStyle(css);
    const $color = $('#color')[0];
    const hueb = new Huebee($color, {
        notation: 'hex',
        setBGColor: 'body'
    });
    hueb.on('change', function(color) {
        saveSettings();
    });

    // ▼ 起動時に設定を復元
    const saved = localStorage.getItem(KEY);
    if (saved) {
        setTimeout(() => {
            applySettings(JSON.parse(saved));
        }, 0);
    }

    // ▼ しおり機能（位置記憶）
    const BOOKMARK_KEY = "aozora_bookmark_" + location.pathname;

    GM_addStyle(`
        #ab-bookmark-panel {
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 9999;
            background: rgba(255, 255, 255, 0.7);
            padding: 5px;
            border: 1px solid #ccc;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            opacity: 0.3;
            transition: opacity 0.3s;
            font-size: 12px;
        }
        #ab-bookmark-panel:hover {
            opacity: 1.0;
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        .ab-btn {
            cursor: pointer;
            padding: 2px 6px;
        }
    `);

    $('body').append(`
        <div id="ab-bookmark-panel">
            <div style="font-weight:bold; text-align:center;">しおり</div>
            <button id="ab-load" class="ab-btn" title="保存した位置へ移動">移動</button>
            <button id="ab-save" class="ab-btn" title="現在の位置を保存">保存</button>
            <span id="ab-msg" style="display:none; color:green; text-align:center;">保存完了</span>
        </div>
    `);

    $('#ab-save').on('click', function() {
        const pos = { top: $(window).scrollTop(), left: $(window).scrollLeft() };
        localStorage.setItem(BOOKMARK_KEY, JSON.stringify(pos));
        $('#ab-msg').fadeIn(200).delay(1000).fadeOut(500);
    });

    $('#ab-load').on('click', function() {
        const saved = localStorage.getItem(BOOKMARK_KEY);
        if (saved) {
            const pos = JSON.parse(saved);
            $('html, body').animate({ scrollTop: pos.top, scrollLeft: pos.left }, 'fast');
        } else {
            alert("しおりがまだありません");
        }
    });

    // ▼ 起動時にしおりを自動ロード
    if (localStorage.getItem(BOOKMARK_KEY)) {
        setTimeout(() => {
            $('#ab-load').click();
        }, 200);
    }
});
