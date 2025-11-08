// ==UserScript==
// @name         [YT] Expand Subtitle Area
// @namespace    http://tampermonkey.net/
// @match        https://www.youtube.com/watch*
// @match        https://www.youtube.com/live*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==

(async function() {
    'use strict';

    const RIGHT_CONTROLS_CLASS_QUERY = ".ytp-right-controls";
    const DEFAULT_PLAYER_ID_QUERY = "#player-container-inner";
    const CINEMATIC_TARGET_ID_QUERY = "#full-bleed-container";
    const VIDEO_CLASS_QUERY = ".video-stream.html5-main-video";

    const EXPAND_RATE_SAVE_ID = "EXPAND_RATE";

    var is_expanding = false;
    var reserved_expanding_state = false;
    var expand_rate = 1.1;
    var control_button = null;

    //---------------------------------------------------------------
    function saveStringToStorage(id, value) {
        //console.debug(`save ${id} : ${value}` );
        localStorage.setItem(id, value);
    }

    function loadStringFromStorage(id, def_value) {
        const value = localStorage.getItem(id);

        if((value === undefined) || (value === null) || isNaN(value) ){
            if(def_value){
                return def_value.toString();
            }
            return null;
        }

        //console.debug(`load ${id} : ${value}` );
        return value;
    }

    //---------------------------------------------------------------
    function watchElementsToAction(query, action, doOnce){
        console.debug('watch: '+ query);

        function resultAction(query_result, observer){
            if(action && query_result){
                Array.from(query_result).forEach(
                    (elm)=>{ action(elm, observer); }
                );

                return true;
            }
            return false;
        };

        // 即実行
        if( resultAction(document.querySelectorAll(query)) && doOnce){
            console.debug('already exists and act done.');
            return null;
        }

        // 変化を監視
        const observer = new MutationObserver((mutations) => {
            Array.from(mutations).some((mutation) => {
                let found = false;
                Array.from(mutation.addedNodes).some((node) => {
                    if(! node.parentNode){
                        return false;
                    }
                    if(typeof(node.parentNode.querySelectorAll) != 'function'){
                        console.debug("parent not have queryselector.")
                        return false;
                    }

                    const query_result = node.parentNode.querySelectorAll(query);
                    if(query_result.length > 0){
                        console.debug(query + " match!")
                        resultAction(query_result, observer);
                    }

                    if(doOnce){
                        observer.disconnect();
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return observer;
    }

    function waitForElements(query){
        return new Promise(
            (resolve) => {
                watchElementsToAction(
                    query,
                    (elements, observer) => {
                        if(observer){
                            observer.disconnect();
                        }
                        resolve(elements);
                    }
                );
            }
        ).then(
            (results) => {
                return results;
            }
        );
    }

    async function watchElementAttribute(query, action){
        let target = await waitForElements(query);

        const observe_cb = (mutations) => {
            //console.debug("attribute mutaion!");
            action();
        };

        // オプションを設定
        const config = {
            attributes: true, // 属性の変更を監視
        };

        //console.debug("attribute watch!");
        //console.debug(target);

        const observer = new MutationObserver(observe_cb, config);
        observer.observe(target, config);
    }

    //-------------------------------------------------------------------

    function updateSubtitleAreaExpand(){
        console.debug("try update");

        const video = document.querySelector(VIDEO_CLASS_QUERY);
        const video_height = parseInt(video.style.height, 10);
        const cinematic_container_height = video_height * expand_rate;
        const default_container_height = cinematic_container_height - video_height;

        const cinema_conteiner = document.querySelector(CINEMATIC_TARGET_ID_QUERY);
        const default_conteiner = document.querySelector(DEFAULT_PLAYER_ID_QUERY);

        if(!cinema_conteiner || !default_conteiner){
            return; // まだない時は諦める
        }

        cinema_conteiner.style.removeProperty('height');
        default_conteiner.style.removeProperty('height');

        if(!is_expanding){
            return;
        }

        if(cinema_conteiner.contains(video)){
            cinema_conteiner.style.height = `${cinematic_container_height}px`;
        } else {
            default_conteiner.style.height = `${default_container_height}px`;
        }

        video.style.top = "0px";
    }

    function adjustExpandRate(delta){
        const val = delta * 0.0001;
        expand_rate += val;
        expand_rate = Math.max(expand_rate, 1.0);
        expand_rate = Math.min(expand_rate, 1.3);

        saveStringToStorage(EXPAND_RATE_SAVE_ID, expand_rate);

        console.log(expand_rate);

        // 更新
        updateSubtitleAreaExpand();
    }

    function addToggleButton(parent){
        let button = document.createElement('button');
        button.id = "ExpandAreaToggleButton";

        button.style.width = "48px";
        button.style.height = "100%";
        button.style.border = 'none';
        button.style.backgroundColor = 'transparent';

        parent.prepend(button);
        console.log("added.");

        // SVG要素を作成
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.border="none";
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        //svg.setAttribute('aspect-ratio', '1 / 1');
        //svg.setAttribute('style', 'border: 1px solid black;');

        // 四角形を描画
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '20%'); // 左上のX座標
        rect.setAttribute('y', '30%'); // 左上のY座標
        rect.setAttribute('rx', '5%'); // 左上のX座標
        rect.setAttribute('ry', '5%'); // 左上のY座標
        rect.setAttribute('width', '60%'); // 幅
        rect.setAttribute('height', '40%'); // 高さ
        rect.setAttribute('fill', 'none'); // 塗りつぶし色
        rect.setAttribute('stroke', 'white'); // 枠線を無効化
        rect.setAttribute('stroke-width', '2'); // 枠線を無効化
        svg.appendChild(rect);


        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '30%'); // 始点のX座標
        line.setAttribute('y1', '60%'); // 始点のY座標
        line.setAttribute('x2', '70%'); // 終点のX座標
        line.setAttribute('y2', '60%'); // 終点のY座標
        line.setAttribute('stroke', 'white'); // 線の色
        line.setAttribute('stroke-width', '2'); // 線の太さ
        svg.appendChild(line);

        // SVGを親要素に追加
        button.appendChild(svg);

        button.addEventListener(
            'click',
            (event) => {
                is_expanding = !is_expanding;

                updateSubtitleAreaExpand(is_expanding);

                if(is_expanding){
                    line.setAttribute('y1', '80%'); // 始点のY座標
                    line.setAttribute('y2', '80%'); // 終点のY座標
                }else{
                    line.setAttribute('y1', '60%'); // 始点のY座標
                    line.setAttribute('y2', '60%'); // 終点のY座標
                }
            }
        );

        button.addEventListener(
            'wheel',
            (event) => {
                event.preventDefault();
                adjustExpandRate(event.deltaY);
            }
        );

        control_button = button;
    }

    document.addEventListener('fullscreenchange', () => {
        console.log('fullscreenchange event fired');
        console.log('document.fullscreenElement:', document.fullscreenElement);
    });

    // フルスクリーンにした時は余白を解除する
    function watchFullscreen()
    {
        document.addEventListener('fullscreenchange', () => {
            if (document.fullscreenElement) {
                // 状態を保存して解除
                reserved_expanding_state = is_expanding;
                is_expanding = false;

                control_button.disabled = true;

            } else {
                // 状態を戻す
                is_expanding = reserved_expanding_state;

                control_button.disabled = false;
            }

            updateSubtitleAreaExpand();
        });
    }

    // スクロールアウトしたら余白解除
    async function watchVideoScrollInOut(){
        // 対象の要素を指定
        const targetElement = await waitForElements(CINEMATIC_TARGET_ID_QUERY);

        // オプション設定
        const observerOptions = {
            root: null, // ビューポートを基準に
            rootMargin: '0px',
            threshold: 0 // ビューポートに入ったり出たりを検知
        };

        // コールバック関数
        const observerCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    is_expanding = reserved_expanding_state;

                } else {
                    reserved_expanding_state = is_expanding;
                    is_expanding = false;
                }

                 updateSubtitleAreaExpand();
            });
        };

        // Observerを作成
        const observer = new IntersectionObserver(observerCallback, observerOptions);

        // 監視を開始
        observer.observe(targetElement);
    }

    //-------------------------------------------------------------------
    // entry
    //-------------------------------------------------------------------
    expand_rate = parseFloat(loadStringFromStorage(EXPAND_RATE_SAVE_ID, 1.1));
    console.debug(`exp_rate:${expand_rate}`);

    watchElementsToAction(RIGHT_CONTROLS_CLASS_QUERY, addToggleButton, true);

    watchElementAttribute(VIDEO_CLASS_QUERY, updateSubtitleAreaExpand);

    watchFullscreen();

    watchVideoScrollInOut();

})();