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

    /**
     * 設定と定数
     */
    const CONFIG = {
        UI_OFFSET_TOP: '70px',
        SETTINGS_KEY: 'notification_filter_settings',
        QUOTE_LABEL: '引用',
        SELECTORS: {
            NOTIFICATION_CELL: 'div[data-testid="cellInnerDiv"]',
            ACCOUNT_BUTTON: 'button[data-testid="SideNav_AccountSwitcher_Button"]',
            PROFILE_IMG: 'img'
        }
    };

    const KEYWORD_GROUPS = [
        {
            name: '主要',
            keywords: ['返信先', CONFIG.QUOTE_LABEL, 'フォローされました']
        },
        {
            name: '反応',
            keywords: [
                'あなたのポストをいいねしました',
                'あなたの返信をいいねしました',
                'あなたのポストをリポストしました',
                'あなたの返信をリポストしました'
            ]
        },
        {
            name: 'その他',
            keywords: [
                'あなたのリポストをいいねしました',
                'あなたのリポストをリポストしました',
                'あなた宛の返信をリポストしました',
                '@ポストをリポストしました'
            ]
        }
    ];

    const STYLES = `
        #filter-settings-panel {
            position: fixed;
            top: ${CONFIG.UI_OFFSET_TOP};
            right: 20px;
            background-color: #15202b;
            color: #ffffff;
            border: 1px solid #38444d;
            border-radius: 12px;
            padding: 16px;
            z-index: 9999;
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
            max-height: 85vh;
            overflow-y: auto;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
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
            transition: opacity 0.2s ease;
        }
        #filter-details-fieldset.filter-disabled {
            opacity: 0.6;
        }
        .filter-row {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
        }
        .filter-group-wrapper {
            display: block;
            margin-bottom: 12px;
            border-top: 1px solid #38444d;
            padding-top: 8px;
        }
        .filter-group-list {
            display: block;
            padding-left: 16px;
            margin-bottom: 0;
        }
        .filter-group-header {
            font-weight: bold;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
        }
        #filter-settings-panel input[type="checkbox"] {
            margin-right: 8px;
            cursor: pointer;
        }
        #filter-settings-panel label {
            font-size: 14px;
            cursor: pointer;
            user-select: none;
        }
    `;

    /**
     * 通知フィルターのメインクラス
     */
    class NotificationFilter {
        constructor() {
            this.settings = {};
            this.ui = {};
            this.myProfileImageSrc = '';
            this.flatKeywords = KEYWORD_GROUPS.flatMap(g => g.keywords);
        }

        async init() {
            await this.loadSettings();
            this.injectStyles();
            this.createUI();
            this.updateUI();
            
            // プロフィール画像取得を開始（非同期）
            this.fetchProfileImage();
            
            // フィルタリング開始
            this.startFiltering();
        }

        async loadSettings() {
            const saved = await GM_getValue(CONFIG.SETTINGS_KEY, {});
            const defaults = { enabled: true };
            this.flatKeywords.forEach(k => defaults[k] = true);
            this.settings = { ...defaults, ...saved };
        }

        async saveSettings() {
            await GM_setValue(CONFIG.SETTINGS_KEY, this.settings);
            this.updateUI();
            this.applyFilter();
        }

        injectStyles() {
            GM_addStyle(STYLES);
        }

        /**
         * UI生成
         */
        createUI() {
            const panel = document.createElement('div');
            panel.id = 'filter-settings-panel';

            // マスタースイッチ
            const masterWrapper = document.createElement('div');
            masterWrapper.id = 'filter-master-switch';
            masterWrapper.className = 'filter-row';
            const masterControls = this.createCheckbox('master', 'フィルターを有効にする', (e) => this.handleMasterChange(e));
            this.ui.masterCheckbox = masterControls.checkbox;
            masterWrapper.append(masterControls.checkbox, masterControls.label);
            panel.appendChild(masterWrapper);

            // 詳細設定エリア
            const fieldset = document.createElement('fieldset');
            fieldset.id = 'filter-details-fieldset';
            this.ui.detailsFieldset = fieldset;

            KEYWORD_GROUPS.forEach((group, idx) => {
                const groupWrapper = document.createElement('div');
                groupWrapper.className = 'filter-group-wrapper';

                // グループヘッダー
                const header = document.createElement('div');
                header.className = 'filter-group-header';
                const groupCb = document.createElement('input');
                groupCb.type = 'checkbox';
                groupCb.id = `group-cb-${idx}`;
                groupCb.addEventListener('change', (e) => this.handleGroupChange(e, group.keywords));
                const groupLabel = document.createElement('label');
                groupLabel.htmlFor = groupCb.id;
                groupLabel.textContent = group.name;
                header.append(groupCb, groupLabel);
                groupWrapper.appendChild(header);

                // キーワードリスト
                const list = document.createElement('div');
                list.className = 'filter-group-list';
                group.keywords.forEach(keyword => {
                    const itemWrapper = document.createElement('div');
                    itemWrapper.className = 'filter-row';
                    const controls = this.createCheckbox(keyword, keyword, (e) => this.handleDetailChange(e));
                    itemWrapper.append(controls.checkbox, controls.label);
                    list.appendChild(itemWrapper);
                });
                groupWrapper.appendChild(list);
                fieldset.appendChild(groupWrapper);
            });

            panel.appendChild(fieldset);
            document.body.appendChild(panel);
        }

        createCheckbox(key, labelText, onChange) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `filter-cb-${key.replace(/\s+/g, '-')}`;
            checkbox.dataset.keyword = key;
            checkbox.addEventListener('change', onChange);
            
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.textContent = labelText;

            return { checkbox, label };
        }

        /**
         * UI状態の更新
         */
        updateUI() {
            // マスタースイッチ
            this.ui.masterCheckbox.checked = this.settings.enabled;

            // 詳細エリアの有効/無効表示
            if (this.settings.enabled) {
                this.ui.detailsFieldset.classList.remove('filter-disabled');
            } else {
                this.ui.detailsFieldset.classList.add('filter-disabled');
            }

            // 各チェックボックス
            this.ui.detailsFieldset.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const key = cb.dataset.keyword;
                if (key && this.settings.hasOwnProperty(key)) {
                    cb.checked = this.settings[key];
                }
            });

            // グループチェックボックス
            KEYWORD_GROUPS.forEach((group, idx) => {
                const groupCb = document.getElementById(`group-cb-${idx}`);
                if (groupCb) {
                    const all = group.keywords.every(k => this.settings[k]);
                    const some = group.keywords.some(k => this.settings[k]);
                    groupCb.checked = all;
                    groupCb.indeterminate = some && !all;
                }
            });
        }

        /**
         * イベントハンドラ
         */
        handleMasterChange(e) {
            this.settings.enabled = e.target.checked;
            
            // ONにした時、全部OFFなら全部ONに戻す（利便性）
            if (this.settings.enabled && this.isAllOff()) {
                this.flatKeywords.forEach(k => this.settings[k] = true);
            }
            this.saveSettings();
        }

        handleGroupChange(e, keywords) {
            const checked = e.target.checked;
            keywords.forEach(k => this.settings[k] = checked);
            this.checkAutoSwitch();
            this.saveSettings();
        }

        handleDetailChange(e) {
            const key = e.target.dataset.keyword;
            this.settings[key] = e.target.checked;
            this.checkAutoSwitch();
            this.saveSettings();
        }

        isAllOff() {
            return this.flatKeywords.every(k => this.settings[k] === false);
        }

        checkAutoSwitch() {
            if (this.isAllOff()) {
                this.settings.enabled = false;
            } else if (!this.settings.enabled) {
                this.settings.enabled = true;
            }
        }

        /**
         * プロフィール画像の取得（引用RTフィルタ用）
         */
        fetchProfileImage() {
            let attempts = 0;
            const maxRetries = 20;
            const interval = 500;

            const timer = setInterval(() => {
                const btn = document.querySelector(CONFIG.SELECTORS.ACCOUNT_BUTTON);
                if (btn) {
                    const img = btn.querySelector(CONFIG.SELECTORS.PROFILE_IMG);
                    if (img && img.src) {
                        // URLのベース部分を抽出
                        const idx = img.src.lastIndexOf('_');
                        this.myProfileImageSrc = (idx !== -1) ? img.src.substring(0, idx) : img.src;
                        
                        console.log(`[X Filter] Profile image found: ${this.myProfileImageSrc}`);
                        clearInterval(timer);
                        this.applyFilter(); // 画像取得後に再フィルタリング
                        return;
                    }
                }

                attempts++;
                if (attempts >= maxRetries) {
                    clearInterval(timer);
                    console.log('[X Filter] Failed to fetch profile image.');
                }
            }, interval);
        }

        /**
         * フィルタリング実行
         */
        applyFilter() {
            if (this.settings.enabled === false) {
                document.querySelectorAll(CONFIG.SELECTORS.NOTIFICATION_CELL).forEach(n => {
                    if (n.style.display === 'none') n.style.display = '';
                });
                return;
            }

            const hiddenKeywords = this.flatKeywords.filter(k => this.settings[k] === false);
            if (hiddenKeywords.length === 0) return;

            document.querySelectorAll(CONFIG.SELECTORS.NOTIFICATION_CELL).forEach(node => {
                const text = node.innerText.toLowerCase();
                
                // 通常キーワード判定
                let shouldHide = hiddenKeywords
                    .filter(k => k !== CONFIG.QUOTE_LABEL)
                    .some(k => text.includes(k.toLowerCase()));

                // 引用RTの特別判定（自分のアイコンが含まれているか）
                if (!shouldHide && this.myProfileImageSrc && hiddenKeywords.includes(CONFIG.QUOTE_LABEL)) {
                    if (node.querySelector(`img[src*="${this.myProfileImageSrc}"]`)) {
                        shouldHide = true;
                    }
                }

                node.style.display = shouldHide ? 'none' : '';
            });
        }

        startFiltering() {
            this.applyFilter();
            const observer = new MutationObserver(() => this.applyFilter());
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    // 実行
    new NotificationFilter().init();
})();
