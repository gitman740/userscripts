// ==UserScript==
// @name         [X] Auto Video Muter
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  タイムラインをスクロールした際に自動再生される動画をミュートします（再生は停止しません）。手動でのミュート解除は維持されます。
// @author       Antigravity
// @match        https://x.com/*
// @grant        none
// @run-at       document-start
// @updateURL    https://github.com/gitman740/userscripts/raw/refs/heads/main/X/auto_video_mute.user.js
// ==/UserScript==

(function () {
    'use strict';

    // 直近のクリック情報を保持する変数
    let lastClickTime = 0;
    let clickedContainer = null;

    function recordClick(e) {
        lastClickTime = Date.now();
        // クリックされた要素の親コンテナ（ビデオプレイヤーまたは記事要素）を取得
        clickedContainer = e.target.closest('[data-testid="videoPlayer"]') || e.target.closest('article') || e.target.closest('video');
    }

    // ページ全体のクリック・タッチイベントをキャプチャフェーズで監視
    document.addEventListener('click', recordClick, true);
    document.addEventListener('pointerdown', recordClick, true);

    // 動画要素にミュート制御を適用する関数
    function setupVideo(video) {
        if (video.dataset.videoMuteSetup) return;
        video.dataset.videoMuteSetup = 'true';

        // 初期状態でミュートにする
        video.muted = true;

        // video要素の再生開始時にもミュートを適用する（自動再生開始時の保険）
        video.addEventListener('play', () => {
            if (video.dataset.userUnmuted !== 'true') {
                video.muted = true;
            }
        });

        // 音量やミュート状態の変更を監視
        video.addEventListener('volumechange', () => {
            // ミュートが解除された（または音量が0より大きくなった）場合
            if (!video.muted && video.volume > 0) {
                // すでにユーザーが手動で解除している場合は何もしない
                if (video.dataset.userUnmuted === 'true') return;

                // 直近のクリックのコンテナと、この動画のコンテナが一致するか判定
                const videoPlayerContainer = video.closest('[data-testid="videoPlayer"]') || video.closest('article');
                const isClickedNearVideo = clickedContainer && (
                    clickedContainer === videoPlayerContainer ||
                    clickedContainer.contains(video) ||
                    video.contains(clickedContainer)
                );

                const timeSinceLastClick = Date.now() - lastClickTime;

                // 直近（500ms以内）に動画周辺でクリックがあった場合は手動解除とみなす
                if (timeSinceLastClick < 500 && isClickedNearVideo) {
                    video.dataset.userUnmuted = 'true';
                } else {
                    // 自動再生などによるシステム側のミュート解除とみなし、ミュートに戻す
                    video.muted = true;
                }
            }
        });
    }

    // 新しく追加されるvideo要素を監視
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === 'VIDEO') {
                        setupVideo(node);
                    } else {
                        const videos = node.querySelectorAll('video');
                        videos.forEach(setupVideo);
                    }
                }
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // 既に存在するvideo要素に対しても適用
    document.querySelectorAll('video').forEach(setupVideo);
})();