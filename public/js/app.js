// RemotePC+ Mobil İstemci - Ana Uygulama Yöneticisi

class RemoteApp {
    constructor() {
        this.ws = null;
        this.currentMode = 'touchpad'; // 'touchpad', 'airmouse', 'context'
        this.isConnected = false;
        this.reconnectTimer = null;
        this.wakeLock = null;
        this.pingTimer = null;

        this.isDragLocked = false;
        this.isLeftHolding = false;

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.initModeTabs();
        this.initBottomButtons();
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
                console.log('[WS] Bağlandı!');
                window.haptics.success();
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
                if (window.multiMonitor) window.multiMonitor.setMonitors(msg.monitors);
                if (window.contextCards) window.contextCards.setContext(msg.context, msg.windowTitle, msg.processName);
                break;

            case 'context_update':
                if (window.contextCards) {
                    window.contextCards.setContext(msg.context, msg.windowTitle, msg.processName);
                }
                break;

            case 'move_ack':
                if (msg.boundaryHit) {
                    window.haptics.boundaryHit();
                    if (window.multiMonitor) window.multiMonitor.showBoundaryFeedback();
                }
                if (msg.monId && window.multiMonitor) {
                    window.multiMonitor.currentMonitorId = msg.monId;
                    window.multiMonitor.updateActiveBadge();
                }
                break;

            case 'pong':
                const pingEl = document.getElementById('latency-val');
                if (pingEl) pingEl.textContent = `${Date.now() - msg.t}ms`;
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

    // Üst Mod Değiştirme Sekmeleri
    initModeTabs() {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                this.switchMode(mode);
            });
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        window.haptics.modeSwitch();

        document.querySelectorAll('.mode-btn').forEach(b => {
            if (b.getAttribute('data-mode') === mode) b.classList.add('active');
            else b.classList.remove('active');
        });

        const viewTouchpad = document.getElementById('view-touchpad');
        const viewAirmouse = document.getElementById('view-airmouse');
        const viewContext = document.getElementById('view-context');

        if (mode === 'touchpad') {
            if (viewTouchpad) viewTouchpad.style.display = 'flex';
            if (viewAirmouse) viewAirmouse.style.display = 'none';
            if (viewContext) viewContext.style.display = 'none';
            if (window.airMouse) window.airMouse.setActive(false);
        } else if (mode === 'airmouse') {
            if (viewTouchpad) viewTouchpad.style.display = 'none';
            if (viewAirmouse) viewAirmouse.style.display = 'flex';
            if (viewContext) viewContext.style.display = 'none';
            if (window.airMouse) window.airMouse.setActive(true);
        } else if (mode === 'context') {
            if (viewTouchpad) viewTouchpad.style.display = 'none';
            if (viewAirmouse) viewAirmouse.style.display = 'none';
            if (viewContext) viewContext.style.display = 'flex';
            if (window.airMouse) window.airMouse.setActive(false);
        }
    }

    // Alt Butonlar (Sol Tık / Sürükle Kilidi / Sağ Tık)
    initBottomButtons() {
        const btnLeft = document.getElementById('btn-click-left');
        const btnRight = document.getElementById('btn-click-right');
        const btnDrag = document.getElementById('btn-drag-lock');

        // Sol Tık - Dokunulduğunda 'down', bırakıldığında 'up' (İki elle tutarak sürüklemeye izin verir)
        if (btnLeft) {
            let leftDownTime = 0;
            const onDown = (e) => {
                e.preventDefault();
                leftDownTime = Date.now();
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

        // Sağ Tık
        if (btnRight) {
            btnRight.addEventListener('click', (e) => {
                e.preventDefault();
                this.send({ type: 'click', button: 'right', state: 'click' });
                window.haptics.rightClick();
            });
        }

        // Sürükle ve Bırak Kilidi (Drag Lock Toggle)
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
                } else {
                    btnDrag.classList.remove('locked');
                    this.send({ type: 'click', button: 'left', state: 'up' });
                    if (dragInd) dragInd.style.display = 'none';
                    window.haptics.click();
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

    // Donanımsal Tuşlar
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
        const dot = document.getElementById('status-dot');
        if (!dot) return;
        dot.className = `status-dot ${status}`;
    }
}

window.app = new RemoteApp();
