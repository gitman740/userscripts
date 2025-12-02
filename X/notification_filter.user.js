// ==UserScript==
// @name        [X] Notification Filter
// @namespace   http://tampermonkey.net/
// @version     0.9
// @description X通知欄の表示制御
// @author      Grok, Gemini
// @match       https://x.com/notifications*
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- 定数定義 ---
    const UI_OFFSET_TOP = '70px';
    const SETTINGS_KEY = 'notification_filter_settings';
    const QUATE_REPOST_LABEL = `引用`;

    // フィルター対象のキーワードリスト
    const filterKeywords = [
        `返信先`,
        QUATE_REPOST_LABEL, // このキーワードは特別なDOMチェックを行う
        `フォローされました`,
        `あなたのポストをいいねしました`,
        `あなたの返信をいいねしました`,
        `あなたのポストをリポストしました`,
        `あなたの返信をリポストしました`,
        'あなたのリポストをいいねしました',
        'あなたのリポストをリポストしました',
        'あなた宛の返信をリポストしました',
        '@ポストをリポストしました',
    ];

    // --- 状態管理 ---
    let settings = {}; // スクリプト全体で共有する設定オブジェクト
    let uiElements = {}; // UI要素を保持するオブジェクト
    let myProfileImageSrc = ''; // ログインユーザーのプロフィール画像URL

    // --- メイン処理 ---

    /**
     * 通知をフィルタリングして表示/非表示を切り替える
     */
    function filterNotifications() {
        // フィルター機能が無効なら、全ての通知を表示して終了
        if (settings.enabled === false) {
            document.querySelectorAll('div[data-testid="cellInnerDiv"]').forEach(n => {
                if (n.style.display === 'none') n.style.display = '';
            });
            return;
        }

        // 非表示にすべきキーワード（チェックが外れているもの）のリストを作成
        const keywordsToHide = filterKeywords.filter(keyword => settings[keyword] === false);

        if (keywordsToHide.length === 0) return; // 非表示対象がなければ処理終了

        document.querySelectorAll('div[data-testid="cellInnerDiv"]').forEach(function(notification) {
            const text = notification.innerText.toLowerCase();

            // 通常のキーワードで非表示にするかチェック
            let shouldHide = keywordsToHide
                .filter(k => k !== QUATE_REPOST_LABEL) // 引用リツイートは別途チェック
                .some(keyword => text.includes(keyword.toLowerCase()));

            // 「引用リツイート」を非表示にする設定の場合、特別なDOMチェックを行う
            if (!shouldHide && myProfileImageSrc && keywordsToHide.includes(QUATE_REPOST_LABEL)) {
                // 通知セル内に、自分のプロフィール画像が部分一致で1つ以上あるかチェックする
                if (notification.querySelector(`img[src*="${myProfileImageSrc}"]`)) {
                    shouldHide = true;
                }
            }

            if (shouldHide) {
                notification.style.display = 'none';
            } else {
                // フィルタ対象外のものは表示状態にする
                notification.style.display = '';
            }
        });
    }

    /**
     * 設定UIのDOMを生成してページに追加する
     */
    function createSettingsPanel() {
        const panel = document.createElement('div');
        panel.id = 'filter-settings-panel';
        uiElements.panel = panel;

        // マスターON/OFFスイッチ
        const masterWrapper = document.createElement('div');
        masterWrapper.id = 'filter-master-switch';
        const { checkbox: masterCheckbox, label: masterLabel } = createCheckboxAndLabel('master', 'フィルターを有効にする', handleMasterChange);
        uiElements.masterCheckbox = masterCheckbox;
        masterWrapper.append(masterCheckbox, masterLabel); // Append both to the wrapper
        panel.appendChild(masterWrapper);

        // 各キーワード設定
        const detailsFieldset = document.createElement('fieldset');
        detailsFieldset.id = 'filter-details-fieldset';
        uiElements.detailsFieldset = detailsFieldset;

        filterKeywords.forEach((keyword) => {
            const wrapper = document.createElement('div'); // 各キーワード用のラッパー
            const { checkbox: keywordCheckbox, label: keywordLabel } = createCheckboxAndLabel(keyword, keyword, handleDetailChange);
            wrapper.append(keywordCheckbox, keywordLabel);
            detailsFieldset.appendChild(wrapper);
        });

        panel.appendChild(detailsFieldset);
        document.body.appendChild(panel);
    }

    /**
     * チェックボックスとラベルのペアを生成するヘルパー関数。
     * 生成された要素をオブジェクトとして返す。
     * @param {string} id - チェックボックスのID（キーワード）
     * @param {string} text - ラベルのテキスト
     * @param {Function} eventHandler - changeイベントのハンドラ
     * @returns {{checkbox: HTMLInputElement, label: HTMLLabelElement}} 生成されたチェックボックスとラベル要素
     */
    function createCheckboxAndLabel(id, text, eventHandler) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `filter-checkbox-${id}`;
        checkbox.dataset.keyword = id;
        checkbox.addEventListener('change', eventHandler);
        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = text;

        return { checkbox, label };
    }

    // --- イベントハンドラ ---

    async function handleMasterChange(e) {
        settings.enabled = e.target.checked;
        updateAndPersist();
    }

    async function handleDetailChange(e) {
        const keyword = e.target.dataset.keyword;
        settings[keyword] = e.target.checked;
        updateAndPersist();
    }

    function applyStyles() {
        GM_addStyle(`
        #filter-settings-panel {
            position: fixed;
            top: ${UI_OFFSET_TOP};
            right: 20px;
            background-color: #15202b;
            color: #ffffff;
            border: 1px solid #38444d;
            border-radius: 12px;
            padding: 16px;
            z-index: 9999;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
        }
        #filter-master-switch {
            padding-bottom: 10px;
            margin-bottom: 10px;
            border-bottom: 1px solid #38444d;
            font-weight: bold;
        }
        #filter-details-fieldset {
            border: none;
            padding: 0;
            margin: 0;
        }
        #filter-details-fieldset:disabled label {
            color: #8b98a5; /* XのUIで使われるグレーに近い色 */
            cursor: not-allowed;
        }
        #filter-settings-panel div {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        #filter-settings-panel input[type="checkbox"] {
            margin-right: 8px;
        }
        #filter-settings-panel label {
            font-size: 14px;
        }
    `);
    }

    /**
     * 設定を保存し、UI更新とフィルタリングを再実行する
     */
    async function updateAndPersist() {
        await GM_setValue(SETTINGS_KEY, settings);
        updateUIVisibility();
        filterNotifications();
    }

    /**
     * 現在の設定に基づいてUI（チェックボックスの状態やグレーアウト）を更新する
     */
    function updateUIVisibility() {
        // マスターチェックボックスの状態を更新
        uiElements.masterCheckbox.checked = settings.enabled;

        // 詳細設定フィールドの有効/無効を切り替え
        uiElements.detailsFieldset.disabled = !settings.enabled;

        // 各詳細チェックボックスの状態を更新
        uiElements.detailsFieldset.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            const keyword = cb.dataset.keyword;
            cb.checked = settings[keyword];
        });
    }

    /**
     * スクリプトの初期化処理
     */
    async function initialize() {
        // --- ステップ1: UIと設定の準備 ---
        // 保存された設定を読み込み、なければデフォルト値を設定
        const savedSettings = await GM_getValue(SETTINGS_KEY, {});
        const defaultSettings = { enabled: true };
        filterKeywords.forEach(keyword => {
            defaultSettings[keyword] = true; // デフォルトですべて表示
        });
        settings = { ...defaultSettings, ...savedSettings };

        // UIを生成・適用し、初期状態を反映
        createSettingsPanel();
        applyStyles();
        updateUIVisibility();

        // --- ステップ2: プロフィール画像の取得を試みる ---
        // ページ描画が完了するまで、一定間隔で取得をリトライする
        let attempts = 0;
        const maxRetries = 20; // 最大20回試行 (約10秒)
        const interval = 500; // 500ミリ秒間隔

        const tryToGetImage = setInterval(() => {
            const accountButton = document.querySelector('button[data-testid="SideNav_AccountSwitcher_Button"]');
            if (accountButton) {
                const profileImg = accountButton.querySelector('img');
                if (profileImg && profileImg.src) {
                    // 成功！URLを保存してリトライを停止
                    const lastUnderscoreIndex = profileImg.src.lastIndexOf('_');
                    if (lastUnderscoreIndex !== -1) {
                        myProfileImageSrc = profileImg.src.substring(0, lastUnderscoreIndex);
                    } else {
                        myProfileImageSrc = profileImg.src; // '_' がない場合はそのまま使う
                    }
                    console.log(`[X Notification Filter] プロフィール画像URLの基本部分を取得しました: ${myProfileImageSrc}`);
                    clearInterval(tryToGetImage);
                    startFiltering(); // フィルタリングを開始
                    return;
                }
            }

            attempts++;
            if (attempts >= maxRetries) {
                clearInterval(tryToGetImage);
                console.log('[X Notification Filter] プロフィール画像URLの取得に失敗しました。引用RTのフィルタリングは機能しません。');
                startFiltering(); // 画像取得に失敗しても、他のフィルターは動作させる
            }
        }, interval);
    }

    /**
     * 最初のフィルタリングを実行し、MutationObserverによる監視を開始する
     */
    function startFiltering() {
        filterNotifications();

        // DOMの変更監視を開始
        const observer = new MutationObserver(filterNotifications);
        observer.observe(document.body, { childList: true, subtree: true });
    }
    // スクリプト実行
    initialize();
})();
