// ==UserScript==
// @name         All Page Bookmark
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Enable bookmarking on any page via menu command (Whitelist mode).
// @author       Gemini Code Assist
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // Prevent running in iframes
    if (window.self !== window.top) return;

    // --- Constants & Config ---
    const STORAGE_KEY_DOMAINS = 'apb_enabled_domains';
    const currentDomain = window.location.hostname;
    const currentPath = window.location.pathname;

    const Config = {
        COLORS: {
            SAVE_BG: '#a8e6cf',
            SAVE_FG: '#333',
            LOAD_BG: '#bde0fe',
            LOAD_FG: '#333',
            PANEL_BG: 'rgba(33, 33, 33, 0.9)',
            PANEL_FG: '#fff',
        },
        TIMING: {
            SCROLL_DURATION: 500,
            SAVED_MSG_DURATION: 1500,
            AUTOLOAD_DELAY: 200,
            OPACITY_TRANSITION: '0.3s',
        },
        OPACITY: {
            NORMAL: '0.25',
            HOVER: '1',
        }
    };

    // --- Storage Module ---
    const Storage = {
        BOOKMARK_KEY: `apb_pos_${currentPath}`,
        PANEL_POS_KEY: `apb_panel_pos_${currentDomain}`,

        getBookmarkPosition() {
            return localStorage.getItem(this.BOOKMARK_KEY);
        },
        setBookmarkPosition(y) {
            localStorage.setItem(this.BOOKMARK_KEY, y);
        },
        getPanelPosition() {
            return GM_getValue(this.PANEL_POS_KEY, null);
        },
        setPanelPosition(pos) {
            GM_setValue(this.PANEL_POS_KEY, pos);
        }
    };

    // --- Whitelist Management ---
    const Whitelist = {
        get() { return GM_getValue(STORAGE_KEY_DOMAINS, []); },
        set(domains) { GM_setValue(STORAGE_KEY_DOMAINS, domains); },
        isEnabled() { return this.get().includes(currentDomain); },
        toggle() {
            const domains = this.get();
            if (this.isEnabled()) {
                const index = domains.indexOf(currentDomain);
                if (index > -1) domains.splice(index, 1);
                alert(`[All Page Bookmark]\nDisabled for: ${currentDomain}\nReloading page...`);
            } else {
                domains.push(currentDomain);
                alert(`[All Page Bookmark]\nEnabled for: ${currentDomain}\nReloading page...`);
            }
            this.set(domains);
            location.reload();
        }
    };

    // --- Menu Registration ---
    if (Whitelist.isEnabled()) {
        GM_registerMenuCommand(`🚫 Disable Bookmark on ${currentDomain}`, Whitelist.toggle.bind(Whitelist));
        initBookmarkUI();
    } else {
        GM_registerMenuCommand(`✅ Enable Bookmark on ${currentDomain}`, Whitelist.toggle.bind(Whitelist));
    }

    // --- Main UI & Logic ---
    function initBookmarkUI() {
        // 1. Create Components
        const wrapper = createWrapper();
        const container = createLabelContainer();
        container.style.gridArea = 'main';
        const label = createLabel();
        const saveBtn = createButton('Save', Config.COLORS.SAVE_BG, Config.COLORS.SAVE_FG);
        saveBtn.style.gridArea = 'save';
        const loadBtn = createButton('Load', Config.COLORS.LOAD_BG, Config.COLORS.LOAD_FG);
        loadBtn.style.gridArea = 'load';

        // 2. Layout & Structure
        container.appendChild(label);
        wrapper.appendChild(container);
        wrapper.appendChild(loadBtn);
        wrapper.appendChild(saveBtn);

        // 3. Logic & Events
        const updateLoadState = () => {
            const hasBookmark = Storage.getBookmarkPosition() !== null;
            loadBtn.disabled = !hasBookmark;
            loadBtn.style.cursor = hasBookmark ? 'pointer' : 'not-allowed';
        };
        setupEventListeners(wrapper, label, saveBtn, loadBtn, updateLoadState);

        // 4. Mount & Init
        document.body.appendChild(wrapper);
        restorePanelPosition(wrapper);
        updateLoadState();

        // Auto-load
        const savedScrollY = Storage.getBookmarkPosition();
        if (savedScrollY !== null) {
            setTimeout(() => smoothScrollTo(parseInt(savedScrollY, 10)), Config.TIMING.AUTOLOAD_DELAY);
        }
    }

    // --- Helpers ---

    function setupEventListeners(wrapper, label, saveBtn, loadBtn, updateLoadState) {
        enableDrag(label, wrapper, (pos) => Storage.setPanelPosition(pos));

        saveBtn.onclick = () => {
            Storage.setBookmarkPosition(window.scrollY);
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            setTimeout(() => { saveBtn.textContent = originalText; }, Config.TIMING.SAVED_MSG_DURATION);
            updateLoadState();
        };

        loadBtn.onclick = () => {
            const scrollY = Storage.getBookmarkPosition();
            if (scrollY !== null) smoothScrollTo(parseInt(scrollY, 10));
        };

        // Hover Effects
        loadBtn.style.visibility = 'hidden';
        saveBtn.style.visibility = 'hidden';

        wrapper.addEventListener('mouseenter', () => {
            wrapper.style.opacity = Config.OPACITY.HOVER;
            updateLoadState();
            loadBtn.style.visibility = loadBtn.disabled ? 'hidden' : 'visible';
            saveBtn.style.visibility = 'visible';
        });
        wrapper.addEventListener('mouseleave', () => {
            wrapper.style.opacity = Config.OPACITY.NORMAL;
            loadBtn.style.visibility = 'hidden';
            saveBtn.style.visibility = 'hidden';
        });
    }

    function createWrapper() {
        const div = document.createElement('div');
        Object.assign(div.style, {
            position: 'fixed',
            zIndex: '2147483647',
            display: 'grid',
            gridTemplateAreas: '"main load" "save ."',
            alignItems: 'center',
            justifyItems: 'center',
            gap: '5px',
            opacity: Config.OPACITY.NORMAL,
            transition: `opacity ${Config.TIMING.OPACITY_TRANSITION}`,
        });
        return div;
    }

    function createLabelContainer() {
        const div = document.createElement('div');
        Object.assign(div.style, {
            backgroundColor: Config.COLORS.PANEL_BG,
            color: Config.COLORS.PANEL_FG,
            padding: '8px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            fontFamily: 'Segoe UI Emoji, sans-serif',
            fontSize: '12px',
            userSelect: 'none',
        });
        return div;
    }

    function createLabel() {
        const div = document.createElement('div');
        div.textContent = '🔖';
        Object.assign(div.style, {
            cursor: 'move',
            textAlign: 'center',
            padding: '4px 0',
            fontSize: '20px',
            lineHeight: '1'
        });
        return div;
    }

    function createButton(text, bgColor, textColor) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            backgroundColor: bgColor,
            border: 'none',
            color: textColor,
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            // Reset styles to prevent site CSS interference
            fontFamily: 'sans-serif',
            fontSize: '12px',
            lineHeight: '1.5',
            margin: '0',
            boxSizing: 'border-box',
            width: '60px',
            textAlign: 'center'
        });
        return btn;
    }

    function restorePanelPosition(element) {
        const savedPos = Storage.getPanelPosition();
        if (savedPos) {
            // Clamp position to viewport
            const val = (s) => parseInt(s, 10) || 0;
            let left = val(savedPos.left);
            let top = val(savedPos.top);

            left = Math.max(0, Math.min(left, window.innerWidth - 50));
            top = Math.max(0, Math.min(top, window.innerHeight - 50));

            element.style.top = `${top}px`;
            element.style.left = `${left}px`;
        } else {
            element.style.bottom = '20px';
            element.style.right = '20px';
        }
    }

    function enableDrag(handle, target, onDragEnd) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = target.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            target.style.bottom = 'auto';
            target.style.right = 'auto';
            target.style.left = `${startLeft}px`;
            target.style.top = `${startTop}px`;
            target.style.opacity = '1';

            e.preventDefault();
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            target.style.left = `${startLeft + dx}px`;
            target.style.top = `${startTop + dy}px`;
        }

        function onMouseUp() {
            if (!isDragging) return;
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (onDragEnd) onDragEnd({ top: target.style.top, left: target.style.left });
        }
    }

    function smoothScrollTo(y, duration = Config.TIMING.SCROLL_DURATION) {
        const startY = window.scrollY;
        const distance = y - startY;
        let startTime = null;

        function animation(currentTime) {
            if (startTime === null) startTime = currentTime;
            const timeElapsed = currentTime - startTime;
            const run = ease(timeElapsed, startY, distance, duration);
            window.scrollTo(0, run);
            if (timeElapsed < duration) requestAnimationFrame(animation);
        }
        
        function ease(t, b, c, d) {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
        }
        requestAnimationFrame(animation);
    }
})();