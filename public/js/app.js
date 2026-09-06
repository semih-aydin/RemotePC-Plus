// RemotePC+ Mobil İstemci - Ana Uygulama Yöneticisi
// Touchpad, Çoklu Monitör, Medya, Klavye, Sesle Yazma, Büyüteç ve Ayar Yönetimi

class RemoteApp {
    constructor() {
        this.ws = null;
        this.currentMode = 'touchpad'; // 'touchpad' veya 'context'
        this.isConnected = false;
        this.reconnectTimer = null;
        this.wakeLock = null;
        this.pingTimer = null;

        this.isDragLocked = false;
        this.isLeftHolding = false;
        this.monitors = [];

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.initModeTabs();
        this.initBottomButtons();
        this.initQuickActionToolbar();
        this.initVirtualKeyboard();
        this.initSpeechToText();
        this.initFullscreenLandscape();
        this.initModals();
        this.initWakeLock();
        this.initHardwareKeys();
    }

    // WebSocket Bağlantısı Kur
    connectWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}`;

        this.updateStatus('connecting');

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.updateStatus('connected');
                console.log('[WS] Sunucuya bağlandı!');
                window.haptics.success();
                this.showToast('Bilgisayara bağlandı', 'success');
                this.startPing();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {}
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateStatus('disconnected');
                clearInterval(this.pingTimer);
                this.scheduleReconnect();
            };

            this.ws.onerror = () => {
                if (this.ws) this.ws.close();
            };
        } catch (e) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectWebSocket();
        }, 2000);
    }

    send(payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'init':
                this.monitors = msg.monitors || [];
                if (window.multiMonitor) window.multiMonitor.setMonitors(this.monitors);
                if (window.contextCards) {
                    window.contextCards.setContext(msg.context, msg.windowTitle, msg.processName);
                }
                break;

            case 'context_update':
                if (window.contextCards) {
                    window.contextCards.setContext(msg.context, msg.windowTitle, msg.processName);
                }
                break;

            case 'move_ack':
                if (msg.boundaryHit && window.haptics) {
                    window.haptics.boundaryHit();
                }
                if (msg.monId && window.multiMonitor) {
                    window.multiMonitor.currentMonitorId = msg.monId;
                    window.multiMonitor.updateActiveBadge();
                }
                break;

            case 'pong':
                const rtt = Date.now() - msg.t;
                const pingEl = document.getElementById('latency-val');
                if (pingEl) {
                    pingEl.textContent = `${rtt}ms`;
                    if (rtt < 25) {
                        pingEl.style.color = '#10b981'; // Yeşil
                    } else if (rtt < 70) {
                        pingEl.style.color = '#fbbf24'; // Sarı
                    } else {
                        pingEl.style.color = '#ef4444'; // Kırmızı
                    }
                }
                break;

            case 'loupe_frame':
                if (window.magnifier) window.magnifier.handleFrame(msg);
                break;
        }
    }

    startPing() {
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping', t: Date.now() });
            }
        }, 2000);
    }

    // Üst Mod Sekmeleri (Touchpad & Medya)
    initModeTabs() {
        document.querySelectorAll('.tab-btn, .mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                this.switchMode(mode);
            });
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        window.haptics.modeSwitch();

        document.querySelectorAll('.tab-btn, .mode-btn').forEach(b => {
            if (b.getAttribute('data-mode') === mode) b.classList.add('active');
            else b.classList.remove('active');
        });

        const viewTouchpad = document.getElementById('view-touchpad');
        const viewContext = document.getElementById('view-context');

        if (mode === 'touchpad') {
            if (viewTouchpad) viewTouchpad.style.display = 'flex';
            if (viewContext) viewContext.style.display = 'none';
        } else if (mode === 'context') {
            if (viewTouchpad) viewTouchpad.style.display = 'none';
            if (viewContext) viewContext.style.display = 'flex';
        }
    }

    // Hızlı Kısayol Araç Çubuğu (Toolbar)
    initQuickActionToolbar() {
        document.querySelectorAll('[data-macro-key]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const macro = btn.getAttribute('data-macro-key');
                if (macro) {
                    const keys = macro.split('+');
                    this.send({ type: 'macro', keys: keys });
                    window.haptics.click();
                    this.showToast(`Kısayol: ${macro.toUpperCase()}`);
                }
            });
        });
    }

    // Sanal Klavye (Metin Girişi)
    initVirtualKeyboard() {
        const kbBtn = document.getElementById('btn-open-keyboard');
        const hiddenInput = document.getElementById('hidden-text-input');

        if (kbBtn && hiddenInput) {
            kbBtn.addEventListener('click', () => {
                hiddenInput.value = '';
                hiddenInput.focus();
                window.haptics.click();
            });

            hiddenInput.addEventListener('input', (e) => {
                const text = hiddenInput.value;
                if (text.length > 0) {
                    this.send({ type: 'type', text: text });
                    hiddenInput.value = '';
                }
            });

            hiddenInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.send({ type: 'key', key: 'enter', state: 'press' });
                } else if (e.key === 'Backspace') {
                    this.send({ type: 'key', key: 'backspace', state: 'press' });
                }
            });
        }
    }

    // Tam Ekran & Yatay Mod Yönetimi (Landscape Mode)
    initFullscreenLandscape() {
        const fsBtn = document.getElementById('btn-fullscreen-toggle');
        if (!fsBtn) return;

        fsBtn.addEventListener('click', async () => {
            try {
                if (!document.fullscreenElement) {
                    if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                    }
                    if (screen.orientation && screen.orientation.lock) {
                        await screen.orientation.lock('landscape').catch(() => {});
                    }
                    fsBtn.innerHTML = '<i class="fas fa-compress"></i> Dikey';
                    window.haptics.modeSwitch();
                    this.showToast('Yatay Tam Ekran Aktif');
                } else {
                    if (document.exitFullscreen) {
                        await document.exitFullscreen();
                    }
                    if (screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    }
                    fsBtn.innerHTML = '<i class="fas fa-expand"></i> Yatay';
                    window.haptics.click();
                }
            } catch (err) {
                console.log('Fullscreen/Orientation hatasi:', err);
            }
        });
    }

    // Sesle Yazma (Speech-to-Text)
    initSpeechToText() {
        const voiceBtn = document.getElementById('btn-voice-input');
        if (!voiceBtn) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            voiceBtn.style.opacity = '0.4';
            voiceBtn.title = 'Tarayıcınız sesle yazmayı desteklemiyor.';
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'tr-TR';
        recognition.continuous = false;
        recognition.interimResults = false;

        let isListening = false;

        voiceBtn.addEventListener('click', () => {
            if (!isListening) {
                try {
                    recognition.start();
                    isListening = true;
                    voiceBtn.classList.add('recording');
                    window.haptics.modeSwitch();
                    this.showToast('Dinleniyor... Konuşun');
                } catch (err) {}
            } else {
                recognition.stop();
                isListening = false;
                voiceBtn.classList.remove('recording');
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                console.log('[Voice] Yazılıyor:', transcript);
                this.send({ type: 'type', text: transcript + ' ' });
                window.haptics.success();
                this.showToast(`Yazıldı: "${transcript}"`, 'success');
            }
        };

        recognition.onend = () => {
            isListening = false;
            voiceBtn.classList.remove('recording');
        };

        recognition.onerror = () => {
            isListening = false;
            voiceBtn.classList.remove('recording');
        };
    }

    // Ayarlar ve Yardım Modalları
    initModals() {
        const btnSettings = document.getElementById('btn-settings-modal');
        const btnCloseSettings = document.getElementById('btn-close-settings');
        const modalSettings = document.getElementById('modal-settings');

        const btnHelp = document.getElementById('btn-help-modal');
        const btnCloseHelp = document.getElementById('btn-close-help');
        const modalHelp = document.getElementById('modal-help');

        if (btnSettings && modalSettings) {
            btnSettings.addEventListener('click', () => {
                modalSettings.classList.add('active');
                window.haptics.click();
            });
        }
        if (btnCloseSettings && modalSettings) {
            btnCloseSettings.addEventListener('click', () => {
                modalSettings.classList.remove('active');
                window.haptics.click();
            });
        }

        if (btnHelp && modalHelp) {
            btnHelp.addEventListener('click', () => {
                modalHelp.classList.add('active');
                window.haptics.click();
            });
        }
        if (btnCloseHelp && modalHelp) {
            btnCloseHelp.addEventListener('click', () => {
                modalHelp.classList.remove('active');
                window.haptics.click();
            });
        }

        // Ayar Kontrolleri Senkronizasyonu
        const sensSlider = document.getElementById('setting-sens-slider');
        const sensVal = document.getElementById('setting-sens-val');
        const chkNatural = document.getElementById('setting-natural-scroll');
        const chkDrag = document.getElementById('setting-doubletap-drag');
        const chkHaptics = document.getElementById('setting-haptics');

        if (sensSlider && window.touchpad) {
            sensSlider.value = window.touchpad.sensitivity;
            if (sensVal) sensVal.textContent = `${window.touchpad.sensitivity.toFixed(2)}x`;

            sensSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (sensVal) sensVal.textContent = `${val.toFixed(2)}x`;
                window.touchpad.updateSettings({ sensitivity: val });
            });
        }

        if (chkNatural && window.touchpad) {
            chkNatural.checked = window.touchpad.naturalScroll;
            chkNatural.addEventListener('change', (e) => {
                window.touchpad.updateSettings({ naturalScroll: e.target.checked });
            });
        }

        if (chkDrag && window.touchpad) {
            chkDrag.checked = window.touchpad.enableDoubleTapDrag;
            chkDrag.addEventListener('change', (e) => {
                window.touchpad.updateSettings({ enableDoubleTapDrag: e.target.checked });
            });
        }

        if (chkHaptics && window.haptics) {
            chkHaptics.checked = window.haptics.enabled;
            chkHaptics.addEventListener('change', (e) => {
                window.haptics.enabled = e.target.checked;
            });
        }
    }

    // Toast Bildirim Sistemi
    showToast(message, type = 'info', duration = 2200) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-item toast-${type}`;
        toast.innerHTML = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('visible');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, duration);
    }

    // Alt Butonlar (Sol Tık / Orta Tık / Sürükle Kilidi / Sağ Tık)
    initBottomButtons() {
        const btnLeft = document.getElementById('btn-click-left');
        const btnMiddle = document.getElementById('btn-click-middle');
        const btnRight = document.getElementById('btn-click-right');
        const btnDrag = document.getElementById('btn-drag-lock');

        if (btnLeft) {
            const onDown = (e) => {
                e.preventDefault();
                this.isLeftHolding = true;
                this.send({ type: 'click', button: 'left', state: 'down' });
                btnLeft.classList.add('active');
                window.haptics.click();
            };

            const onUp = (e) => {
                e.preventDefault();
                this.isLeftHolding = false;
                this.send({ type: 'click', button: 'left', state: 'up' });
                btnLeft.classList.remove('active');
            };

            btnLeft.addEventListener('touchstart', onDown, { passive: false });
            btnLeft.addEventListener('touchend', onUp, { passive: false });
            btnLeft.addEventListener('touchcancel', onUp, { passive: false });
            btnLeft.addEventListener('mousedown', onDown);
            btnLeft.addEventListener('mouseup', onUp);
        }

        if (btnMiddle) {
            btnMiddle.addEventListener('click', (e) => {
                e.preventDefault();
                this.send({ type: 'click', button: 'middle', state: 'click' });
                window.haptics.middleClick();
            });
        }

        if (btnRight) {
            btnRight.addEventListener('click', (e) => {
                e.preventDefault();
                this.send({ type: 'click', button: 'right', state: 'click' });
                window.haptics.rightClick();
            });
        }

        if (btnDrag) {
            btnDrag.addEventListener('click', (e) => {
                e.preventDefault();
                this.isDragLocked = !this.isDragLocked;

                const dragInd = document.getElementById('drag-status-indicator');

                if (this.isDragLocked) {
                    btnDrag.classList.add('locked');
                    this.send({ type: 'click', button: 'left', state: 'down' });
                    if (dragInd) dragInd.style.display = 'block';
                    window.haptics.modeSwitch();
                    this.showToast('Sürükleme Kilidi Açıldı (Sol Tık Basılı)');
                } else {
                    btnDrag.classList.remove('locked');
                    this.send({ type: 'click', button: 'left', state: 'up' });
                    if (dragInd) dragInd.style.display = 'none';
                    window.haptics.click();
                    this.showToast('Sürükleme Bırakıldı');
                }
            });
        }
    }

    // Wake Lock
    async initWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (e) {}
        }
    }

    // Donanımsal Ses Tuşları ile Sunum/Medya Kontrolü
    initHardwareKeys() {
        window.addEventListener('keydown', (e) => {
            if (this.currentMode === 'context') {
                if (e.key === 'VolumeUp') {
                    this.send({ type: 'presentation', action: 'next' });
                    window.haptics.click();
                    e.preventDefault();
                } else if (e.key === 'VolumeDown') {
                    this.send({ type: 'presentation', action: 'prev' });
                    window.haptics.click();
                    e.preventDefault();
                }
            }
        });
    }

    updateStatus(status) {
        const pingEl = document.getElementById('latency-val');
        if (pingEl && status === 'disconnected') {
            pingEl.textContent = 'Bağlantı koptu';
            pingEl.style.color = '#ef4444';
        }
    }
}

window.app = new RemoteApp();
