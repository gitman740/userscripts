// ==UserScript==
// @name         [YT] Audio Panner
// @namespace    http://tampermonkey.net/
// @version      0.9.2
// @description  スライダーで左右ブレンド率を調整する
// @match        *://www.youtube.com/*
// @grant        none
// @updateURL    https://github.com/gitman740/userscripts/raw/refs/heads/main/YouTube/audio_panner.user.js
// ==/UserScript==

(function () {
    "use strict";

    /*==============================================
      グローバル変数・マップ
    ==============================================*/
    let stereoEnabled = false;
    let currentBlendValue = 0; // -100 ～ 100 (0 は中立)
    let iconHovered = false;   // アイコン上のマウスホバー状態
    const processedAudio = new WeakMap(); // メモリリーク防止のため WeakMap に変更
    let globalAudioCtx = null; // AudioContext のシングルトン

    /*==============================================
      オーディオ処理部
    ==============================================*/
    function setupMediaElement(mediaEl) {
        if (processedAudio.has(mediaEl)) return;
        try {
            if (!globalAudioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                globalAudioCtx = new AudioCtx();
            }
            const audioCtx = globalAudioCtx;
            const source = audioCtx.createMediaElementSource(mediaEl);

            // bypass 経路：元の音声をそのまま出力
            const bypassGain = audioCtx.createGain();
            source.connect(bypassGain);
            bypassGain.connect(audioCtx.destination);

            // stereo 経路の構築
            const splitter = audioCtx.createChannelSplitter(2);
            const merger = audioCtx.createChannelMerger(2);
            source.connect(splitter);

            // 左側の処理: 左チャンネル本来の信号 + 右チャンネルの crossfeed
            const leftGain = audioCtx.createGain();
            const crossRightToLeftGain = audioCtx.createGain();
            splitter.connect(leftGain, 0);
            leftGain.connect(merger, 0, 0);
            splitter.connect(crossRightToLeftGain, 1);
            crossRightToLeftGain.connect(merger, 0, 0);

            // 右側の処理: 右チャンネル本来の信号 + 左チャンネルの crossfeed
            const rightGain = audioCtx.createGain();
            const crossLeftToRightGain = audioCtx.createGain();
            splitter.connect(rightGain, 1);
            rightGain.connect(merger, 0, 1);
            splitter.connect(crossLeftToRightGain, 0);
            crossLeftToRightGain.connect(merger, 0, 1);

            // 初期ゲイン (blend = 0)
            leftGain.gain.value = 1;
            crossRightToLeftGain.gain.value = 0;
            rightGain.gain.value = 1;
            crossLeftToRightGain.gain.value = 0;

            // 各情報を Map に格納
            processedAudio.set(mediaEl, {
                audioCtx,
                source,
                bypassGain,
                splitter,
                merger,
                leftGain,
                crossRightToLeftGain,
                rightGain,
                crossLeftToRightGain,
                isStereoActive: false,
            });
            console.log("Setup complete for media element:", mediaEl);
        } catch (e) {
            console.error("Error setting up media element:", e);
        }
    }

    function updateBlendForElement(data, blendValue) {
        if (blendValue < 0) {
            const alpha = Math.abs(blendValue) / 100;
            data.leftGain.gain.value = 1 - alpha;
            data.crossRightToLeftGain.gain.value = alpha;
            data.rightGain.gain.value = 1;
            data.crossLeftToRightGain.gain.value = 0;
        } else if (blendValue > 0) {
            const alpha = blendValue / 100;
            data.leftGain.gain.value = 1;
            data.crossRightToLeftGain.gain.value = 0;
            data.rightGain.gain.value = 1 - alpha;
            data.crossLeftToRightGain.gain.value = alpha;
        } else {
            data.leftGain.gain.value = 1;
            data.crossRightToLeftGain.gain.value = 0;
            data.rightGain.gain.value = 1;
            data.crossLeftToRightGain.gain.value = 0;
        }
    }

    function updateBlendAll(blendValue) {
        currentBlendValue = blendValue;
        // WeakMap は反復不能なため、DOM上の要素からルックアップする
        document.querySelectorAll("video, audio").forEach((el) => {
            const data = processedAudio.get(el);
            if (data && data.isStereoActive) {
                updateBlendForElement(data, blendValue);
            }
        });
    }

    function enableStereoForMedia(mediaEl) {
        setupMediaElement(mediaEl);
        const data = processedAudio.get(mediaEl);
        if (data.isStereoActive) return;
        try {
            data.bypassGain.disconnect(data.audioCtx.destination);
        } catch (e) {
            console.error("Error disconnecting bypass branch:", e);
        }
        try {
            data.merger.connect(data.audioCtx.destination);
            updateBlendForElement(data, currentBlendValue);
            data.isStereoActive = true;
            console.log("Stereo branch enabled for media element:", mediaEl);
        } catch (e) {
            console.error("Error connecting stereo branch:", e);
        }
    }

    function enableStereo() {
        document.querySelectorAll("video, audio").forEach((el) => {
            enableStereoForMedia(el);
        });
        stereoEnabled = true;
        // コンテキストがサスペンド状態なら再開（ブラウザの自動再生ポリシー対策）
        if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
            globalAudioCtx.resume();
        }
        console.info("Stereo processing enabled for the page.");
    }

    // 動的に追加されるメディア要素に対応するための MutationObserver
    const observer = new MutationObserver((mutations) => {
        // プレイヤーUIが再描画された場合にボタンを再配置
        if (!document.getElementById("stereo-toggle-btn")) {
            tryAddButton();
        }

        if (!stereoEnabled) return;

        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches("video, audio")) {
                        enableStereoForMedia(node);
                    }
                    const childMedias = node.querySelectorAll && node.querySelectorAll("video, audio");
                    if (childMedias && childMedias.length) {
                        childMedias.forEach((el) => enableStereoForMedia(el));
                    }
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    /*==============================================
      UI 部分
    ==============================================*/
    // Trusted Types 対応（対応ブラウザの場合）
    const policy = window.trustedTypes
        ? window.trustedTypes.createPolicy("default", { createHTML: (input) => input })
        : null;

    // スライダーのスタイル設定用の <style> を作成
    const sliderStyleEl = document.createElement("style");
    sliderStyleEl.textContent = `
      /* スライダーのトラック設定：左側は lightblue、右側は lightcoral のグラデーション */
      #stereo-blend-slider {
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        width: 100px;
        border-radius: 2px;
        background: linear-gradient(to right, lightblue 0%, lightblue 50%, lightcoral 50%, lightcoral 100%);
        outline: none;
        position: absolute;
        z-index: 1000;
        display: none;
      }
      /* WebKit 用つまみ : 白色 */
      #stereo-blend-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: white;
        border: 1px solid #999;
        cursor: pointer;
        margin-top: -4px;
      }
      /* Firefox 用つまみ */
      #stereo-blend-slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: white;
        border: 1px solid #999;
        cursor: pointer;
      }
    `;
    document.head.appendChild(sliderStyleEl);

    /**
     * blendSlider 作成
     * ・タイプは range、値域は -100～100（初期値 0）
     * ・input イベントでグラデーション色を更新
     * ・blur 時は、アイコンにホバーしていなければ非表示にする
     */
    function createBlendSlider() {
        const slider = document.createElement("input");
        slider.id = "stereo-blend-slider";
        slider.type = "range";
        slider.min = "-100";
        slider.max = "100";
        slider.value = "0";
        slider.style.background =
            "linear-gradient(to right, lightblue 0%, lightblue 50%, lightcoral 50%, lightcoral 100%)";
        slider.addEventListener("input", (e) => {
            const val = parseInt(e.target.value, 10);
            updateBlendAll(val);
            const min = -100,
                max = 100;
            const percentage = ((val - min) / (max - min)) * 100;
            slider.style.background = `linear-gradient(to right, lightblue 0%, lightblue ${percentage}%, lightcoral ${percentage}%, lightcoral 100%)`;
        });
        // blur 時は、少し待ってからアイコンホバー状態でなければ非表示
        slider.addEventListener("blur", () => {
            setTimeout(() => {
                if (!iconHovered && !slider.matches(":focus")) {
                    slider.style.display = "none";
                }
            }, 50);
        });
        return slider;
    }
    let blendSlider = createBlendSlider();

    /*----------------------------------------------
      アイコン SVG (リボン風―左右に広がる、「音のバランス」感を表現)
      ここでは6本の円弧（外側＝大、中＝中、内側＝小）を左右で描いています。
    ----------------------------------------------*/
    const iconSVG = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
        <g stroke="currentColor" stroke-width="2" fill="none">
          <!-- 左側の円弧群 (左向き) -->
          <path d="M10,8 A4,8 0 0,0 10,24" />
          <path d="M12,10 A3,6 0 0,0 12,22" />
          <path d="M14,12 A2,4 0 0,0 14,20" />
          <!-- 右側の円弧群 (右向き) -->
          <path d="M22,8 A4,8 0 0,1 22,24" />
          <path d="M20,10 A3,6 0 0,1 20,22" />
          <path d="M18,12 A2,4 0 0,1 18,20" />
        </g>
      </svg>
    `;

    /*----------------------------------------------
      アイコンボタンの追加
      ・設定アイコン（.ytp-settings-button）の隣（左側）にボタンを配置
      ・クリック時、アイコンの絶対位置（スクロール位置を加味）を計算してスライダー表示／非表示を切り替え
      ・アイコンのホバー状態でスライダーの非表示タイミングを調整
    ----------------------------------------------*/
    function tryAddButton() {
        const settingsButton = document.querySelector(".ytp-settings-button");
        // 既にボタンがある、または設定ボタンが見つからない場合は何もしない
        if (!settingsButton || document.getElementById("stereo-toggle-btn")) return;

        const btn = document.createElement("button");
        btn.id = "stereo-toggle-btn";
        btn.title = "ブレンド調整スライダーを表示／非表示";
        btn.style.cssText = `
            background: none;
            border: none;
            cursor: pointer;
            width: 48px;
            height: 40px;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0;
            color: white;
        `;
        btn.innerHTML = policy ? policy.createHTML(iconSVG) : iconSVG;

        // アイコンのホバー管理
        btn.addEventListener("mouseenter", () => {
            iconHovered = true;
        });
        btn.addEventListener("mouseleave", () => {
            iconHovered = false;
            if (!blendSlider.matches(":focus")) {
                blendSlider.style.display = "none";
            }
        });

        // クリック時には、アイコンの絶対位置からスライダーを配置
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            // 既に表示されていれば閉じる
            if (blendSlider.style.display === "block") {
                blendSlider.style.display = "none";
                return;
            }
            if (!stereoEnabled) {
                enableStereo();
            }
            const btnRect = btn.getBoundingClientRect();
            const absLeft = btnRect.left + (window.pageXOffset || document.documentElement.scrollLeft);
            const absTop = btnRect.top + (window.pageYOffset || document.documentElement.scrollTop);
            // 幅 100px のスライダーをボタン中央から左右 -50px に配置
            blendSlider.style.left = (absLeft + btnRect.width / 2 - 50) + "px";
            // ボタン上部 20px 上に配置
            blendSlider.style.top = (absTop - 20) + "px";
            if (!document.body.contains(blendSlider)) {
                document.body.appendChild(blendSlider);
            }
            blendSlider.style.display = "block";
            blendSlider.focus();
        });

        settingsButton.insertAdjacentElement("beforebegin", btn);
        console.info("Stereo slider button added.");
    }
    // 初期実行（ロード済みの場合に対応）
    tryAddButton();

})();
