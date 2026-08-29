// Universal Wireless Control Hub - Ana Mobil Istemci Yoneticisi
// WebSocket baglantisi, mod degisimleri, akilli tiklama butonlari ve wake lock

class RemoteApp {
    constructor() {
        this.ws = null;
        this.currentMode = 'touchpad'; // 'touchpad', 'airmouse', 'media', 'presentation', 'productivity'
        this.isConnected = false;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.wakeLock = null;

        // Ping olcumu
        this.pingInterval = null;
        this.currentPing = 0;

        // Drag Lock Durumu
        this.isDragLocked = false;

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.initModeSelector();
        this.initSmartClickZones();
        this.initWakeLock();
        this.initHardwareKeys();
        this.registerServiceWorker();
    }

    // WebSocket Baglantisi Kur (WSS veya WS)
    connectWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${location.host}`;

        console.log(`[WebSocket] Baglaniyor: ${wsUrl}`);
        this.updateStatusBadge('connecting');

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateStatusBadge('connected');
                console.log('[WebSocket] Baglanti basariyla kuruldu!');
                window.haptics.success();

                // Ping olcumunu baslat (Her 2 saniyede bir)
                this.startPing();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.log('Mesaj cozumleme hatasi:', e);
                }
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.updateStatusBadge('disconnected');
                clearInterval(this.pingInterval);
                console.log('[WebSocket] Baglanti koptu. Tekrar deneniyor...');
                this.scheduleReconnect();
            };

            this.ws.onerror = (err) => {
                console.log('[WebSocket] Hata olustu:', err);
                this.ws.close();
            };
        } catch (e) {
            console.log('Soket olusturulamadi:', e);
            this.scheduleReconnect();
        }
    }

    // Yeniden baglanma zamanlayicisi
    scheduleReconnect() {
        if (this.reconnectTimer) return;
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 5000);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connectWebSocket();
        }, delay);
    }

    // Sunucuya JSON paket yolla
    send(payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }

    // Gelen WebSocket paketlerini isle
    handleMessage(msg) {
        switch (msg.type) {
            case 'init':
                console.log('[Init] Sunucu baslangic verisi alindi:', msg);
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
                const rtt = Date.now() - msg.t;
                this.currentPing = rtt;
                const pingEl = document.getElementById('latency-indicator');
                if (pingEl) pingEl.textContent = `${rtt} ms`;
                break;

            case 'loupe_frame':
                if (window.magnifier) {
                    window.magnifier.handleFrame(msg);
                }
                break;

            case 'monitor_jumped':
                if (window.multiMonitor) {
                    window.multiMonitor.currentMonitorId = msg.monitorId;
                    window.multiMonitor.updateActiveBadge();
                }
                break;
        }
    }

    // Duzenli Ping Olcumu
    startPing() {
        clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.send({ type: 'ping', t: Date.now() });
            }
        }, 2000);
    }

    // Mod Degistirme (Air Mouse / Touchpad / Media / Sunum / Uretkenlik)
    initModeSelector() {
        document.querySelectorAll('.mode-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetMode = btn.getAttribute('data-mode');
                this.switchMode(targetMode);
            });
        });
    }

    switchMode(mode) {
        this.currentMode = mode;
        window.haptics.modeSwitch();

        // Butonlari aktif yap
        document.querySelectorAll('.mode-tab-btn').forEach(b => {
            if (b.getAttribute('data-mode') === mode) b.classList.add('active');
            else b.classList.remove('active');
        });

        // Mod ekranlarini guncelle
        const touchpadView = document.getElementById('touchpad-view');
        const airmouseView = document.getElementById('airmouse-view');
        const contextView = document.getElementById('context-cards-view');

        if (mode === 'touchpad') {
            if (touchpadView) touchpadView.style.display = 'flex';
            if (airmouseView) airmouseView.style.display = 'none';
            if (contextView) contextView.style.display = 'none';
            if (window.airMouse) window.airMouse.setActive(false);
        } else if (mode === 'airmouse') {
            if (touchpadView) touchpadView.style.display = 'none';
            if (airmouseView) airmouseView.style.display = 'flex';
            if (contextView) contextView.style.display = 'none';
            if (window.airMouse) window.airMouse.setActive(true);
        } else {
            // Media, Presentation veya Productivity ozel kartlari
            if (touchpadView) touchpadView.style.display = 'none';
            if (airmouseView) airmouseView.style.display = 'none';
            if (contextView) contextView.style.display = 'flex';
            if (window.airMouse) window.airMouse.setActive(false);
            if (window.contextCards) window.contextCards.setManualContext(mode);
        }
    }

    // Akilli Tiklama Alanlari (Ergonomic Click Zones)
    initSmartClickZones() {
        const btnLeft = document.getElementById('click-zone-left');
        const btnRight = document.getElementById('click-zone-right');
        const btnMiddle = document.getElementById('click-zone-middle');
        const btnDragLock = document.getElementById('drag-lock-btn');

        if (btnLeft) {
            btnLeft.addEventListener('click', () => {
                this.send({ type: 'click', button: 'left', state: 'click' });
                window.haptics.click();
            });
        }

        if (btnRight) {
            btnRight.addEventListener('click', () => {
                this.send({ type: 'click', button: 'right', state: 'click' });
                window.haptics.rightClick();
            });
        }

        if (btnMiddle) {
            btnMiddle.addEventListener('click', () => {
                this.send({ type: 'click', button: 'middle', state: 'click' });
                window.haptics.middleClick();
            });
        }

        // Drag Lock (Sol tusu basili tutma kilidi)
        if (btnDragLock) {
            btnDragLock.addEventListener('click', () => {
                this.isDragLocked = !this.isDragLocked;
                if (this.isDragLocked) {
                    btnDragLock.classList.add('locked');
                    this.send({ type: 'click', button: 'left', state: 'down' });
                    window.haptics.modeSwitch();
                } else {
                    btnDragLock.classList.remove('locked');
                    this.send({ type: 'click', button: 'left', state: 'up' });
                    window.haptics.click();
                }
            });
        }
    }

    // Ekranin Kapanmasini Onle (Screen Wake Lock)
    async initWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('[WakeLock] Ekran kapanma engeli aktif!');
                document.addEventListener('visibilitychange', async () => {
                    if (this.wakeLock !== null && document.visibilityState === 'visible') {
                        this.wakeLock = await navigator.wakeLock.request('screen');
                    }
                });
            } catch (err) {
                console.log('WakeLock hatasi:', err);
            }
        }
    }

    // Fiziksel Ses Tuslarini Yeniden Haritalama (Hardware Button Remapping)
    initHardwareKeys() {
        window.addEventListener('keydown', (e) => {
            // Sunum modundaysa ses tuslari slayt ilerletir
            if (this.currentMode === 'presentation') {
                if (e.key === 'VolumeUp' || e.key === 'ArrowRight' || e.key === 'PageDown') {
                    this.send({ type: 'presentation', action: 'next' });
                    window.haptics.click();
                    e.preventDefault();
                } else if (e.key === 'VolumeDown' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
                    this.send({ type: 'presentation', action: 'prev' });
                    window.haptics.click();
                    e.preventDefault();
                }
            }
            // Air Mouse modundaysa VolumeDown tusu Clutch gorevi gorur
            else if (this.currentMode === 'airmouse') {
                if (e.key === 'VolumeDown') {
                    if (window.airMouse) window.airMouse.isClutched = true;
                    window.haptics.clutchEngaged();
                    e.preventDefault();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.currentMode === 'airmouse' && e.key === 'VolumeDown') {
                if (window.airMouse) window.airMouse.isClutched = false;
                window.haptics.clutchReleased();
                e.preventDefault();
            }
        });
    }

    // Baglanti Durum Rozetini Guncelle
    updateStatusBadge(status) {
        const badge = document.getElementById('connection-status-badge');
        const text = document.getElementById('connection-status-text');

        if (!badge || !text) return;

        badge.className = `status-indicator ${status}`;
        if (status === 'connected') {
            text.textContent = 'Bağlandı';
        } else if (status === 'connecting') {
            text.textContent = 'Bağlanıyor...';
        } else {
            text.textContent = 'Koptu';
        }
    }

    // PWA Service Worker kaydi
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(e => {
                console.log('SW kayit hatasi:', e);
            });
        }
    }
}

window.app = new RemoteApp();
