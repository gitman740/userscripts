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

    // --- Constants & Config ---
    const STORAGE_KEY_DOMAINS = 'apb_enabled_domains';
    const currentDomain = window.location.hostname;

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
        const BOOKMARK_KEY = `apb_pos_${window.location.pathname}`;
        const PANEL_POS_KEY = `apb_panel_pos_${currentDomain}`;

        // 1. Create Components
        const container = createContainer();
        const label = createLabel();
        const saveBtn = createButton('Save', '#a8e6cf', '#333');
        const loadBtn = createButton('Load', '#bde0fe', '#333');

        // 2. Layout & Styles
        setupOverlayLayout(container, label, saveBtn, loadBtn);
        restorePanelPosition(container, PANEL_POS_KEY);

        // 3. Logic & Events
        enableDrag(label, container, (pos) => GM_setValue(PANEL_POS_KEY, pos));

        // Button Actions
        const updateLoadState = () => {
            const hasBookmark = localStorage.getItem(BOOKMARK_KEY) !== null;
            loadBtn.disabled = !hasBookmark;
            loadBtn.style.cursor = hasBookmark ? 'pointer' : 'not-allowed';
        };

        saveBtn.onclick = () => {
            localStorage.setItem(BOOKMARK_KEY, window.scrollY);
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            setTimeout(() => { saveBtn.textContent = originalText; }, 1500);
            updateLoadState();
        };

        loadBtn.onclick = () => {
            const scrollY = localStorage.getItem(BOOKMARK_KEY);
            if (scrollY !== null) smoothScrollTo(parseInt(scrollY, 10));
        };

        // Hover Effects
        setupHoverEffects(container, saveBtn, loadBtn);

        // 4. Mount & Init
        container.appendChild(label);
        container.appendChild(saveBtn);
        container.appendChild(loadBtn);
        document.body.appendChild(container);

        updateLoadState();

        // Auto-load
        const savedScrollY = localStorage.getItem(BOOKMARK_KEY);
        if (savedScrollY !== null) {
            setTimeout(() => smoothScrollTo(parseInt(savedScrollY, 10)), 200);
        }
    }

    // --- Helpers ---

    function createContainer() {
        const div = document.createElement('div');
        Object.assign(div.style, {
            position: 'fixed',
            zIndex: '2147483647',
            backgroundColor: 'rgba(33, 33, 33, 0.9)',
            color: '#fff',
            padding: '8px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: 'Segoe UI Emoji, sans-serif',
            fontSize: '12px',
            userSelect: 'none',
            opacity: '0.25',
            transition: 'opacity 0.3s',
            overflow: 'visible'
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
            transition: 'opacity 0.2s'
        });
        return btn;
    }

    function setupOverlayLayout(container, label, saveBtn, loadBtn) {
        const overlayBtnStyle = {
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max-content',
            opacity: '0',
            pointerEvents: 'none',
            transition: 'opacity 0.2s, transform 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: '-1'
        };
        Object.assign(loadBtn.style, overlayBtnStyle);
        Object.assign(saveBtn.style, overlayBtnStyle);

        // Load Button (Top)
        loadBtn.style.bottom = '100%';
        loadBtn.style.marginBottom = '0';
        loadBtn.style.borderBottom = '5px solid transparent';
        loadBtn.style.backgroundClip = 'padding-box';

        // Save Button (Bottom)
        saveBtn.style.top = '100%';
        saveBtn.style.marginTop = '0';
        saveBtn.style.borderTop = '5px solid transparent';
        saveBtn.style.backgroundClip = 'padding-box';
    }

    function setupHoverEffects(container, saveBtn, loadBtn) {
        container.addEventListener('mouseenter', () => {
            container.style.opacity = '1';
            
            loadBtn.style.opacity = loadBtn.disabled ? '0.5' : '1';
            loadBtn.style.pointerEvents = 'auto';
            loadBtn.style.transform = 'translateX(-50%) translateY(-3px)';

            saveBtn.style.opacity = '1';
            saveBtn.style.pointerEvents = 'auto';
            saveBtn.style.transform = 'translateX(-50%) translateY(3px)';
        });

        container.addEventListener('mouseleave', () => {
            container.style.opacity = '0.25';
            
            loadBtn.style.opacity = '0';
            loadBtn.style.pointerEvents = 'none';
            loadBtn.style.transform = 'translateX(-50%) translateY(0)';

            saveBtn.style.opacity = '0';
            saveBtn.style.pointerEvents = 'none';
            saveBtn.style.transform = 'translateX(-50%) translateY(0)';
        });
    }

    function restorePanelPosition(element, key) {
        const savedPos = GM_getValue(key, null);
        if (savedPos) {
            element.style.top = savedPos.top;
            element.style.left = savedPos.left;
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

    function smoothScrollTo(y, duration = 500) {
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