// ==UserScript==
// @name         Audible Web Player Volume Slider
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  AudibleのWebプレイヤーにボリュームスライダーを追加します
// @author       Gemini Code Assist
// @match        https://www.audible.co.jp/webplayer*
// @match        https://www.audible.com/webplayer*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SLIDER_ID = 'audible-custom-volume-slider-container';
    const STYLE_ID = 'audible-custom-volume-style';
    const STORAGE_KEY = 'audible-volume-level';

    let currentAudio = null;
    let removeListener = null;

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${SLIDER_ID} {
                position: fixed;
                top: 20px;
                left: 20px;
                z-index: 9999;
                background-color: rgba(0, 0, 0, 0.7);
                padding: 10px;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                color: white;
                font-family: sans-serif;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                opacity: 0.25;
                transition: opacity 0.2s ease;
            }
            #${SLIDER_ID}:hover {
                opacity: 1;
            }
            #${SLIDER_ID} input[type="range"] {
                display: none;
                margin-top: 10px;
                -webkit-appearance: slider-vertical;
                width: 8px;
                height: 100px;
                cursor: pointer;
            }
            #${SLIDER_ID}:hover input[type="range"] {
                display: block;
            }
        `;
        document.head.appendChild(style);
    }

    function createSlider(audio) {
        // 既存のスライダーがあれば削除（オーディオ要素が変わった場合のリセット用）
        const existing = document.getElementById(SLIDER_ID);
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.id = SLIDER_ID;

        const label = document.createElement('span');
        label.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" fill="white"><path d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320Z"/></svg>';
        label.style.display = 'flex';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 0;
        slider.max = 1;
        slider.step = 0.01;
        slider.value = audio.volume;
        slider.setAttribute('orient', 'vertical');

        slider.addEventListener('input', (e) => {
            audio.volume = e.target.value;
            localStorage.setItem(STORAGE_KEY, e.target.value);
        });

        const onVolumeChange = () => {
            slider.value = audio.volume;
            localStorage.setItem(STORAGE_KEY, audio.volume);
        };

        audio.addEventListener('volumechange', onVolumeChange);

        container.appendChild(label);
        container.appendChild(slider);
        document.body.appendChild(container);

        return () => audio.removeEventListener('volumechange', onVolumeChange);
    }

    function initAudio(audio) {
        if (removeListener) removeListener();

        const savedVolume = localStorage.getItem(STORAGE_KEY);
        if (savedVolume !== null) {
            audio.volume = parseFloat(savedVolume);
        }
        injectStyles();
        removeListener = createSlider(audio);
        console.log('Audible Volume Slider attached.');
    }

    function check() {
        const audio = document.querySelector('audio');
        const slider = document.getElementById(SLIDER_ID);

        // オーディオがない場合は何もしない
        if (!audio) return;

        // オーディオが変わった、またはスライダーが消えている場合は再生成
        if (audio !== currentAudio || !slider) {
            currentAudio = audio;
            initAudio(audio);
        }
    }

    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    
    check();

})();
