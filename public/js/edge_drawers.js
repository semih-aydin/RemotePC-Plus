// Edge Swipe Drawers (Kenar Cekmeceleri)
// Sol: Klavye + Sesle Yazma (Voice-to-Text) + Pano
// Sag: Numpad + Makro Paleti
// Alt: Ekran Secici (Monitor Jump) + DPI Ayarlari + Istatistikler

class EdgeDrawersManager {
    constructor() {
        this.leftDrawer = document.getElementById('drawer-left');
        this.rightDrawer = document.getElementById('drawer-right');
        this.bottomDrawer = document.getElementById('drawer-bottom');
        this.backdrop = document.getElementById('drawer-backdrop');

        this.activeDrawer = null;
        this.startX = 0;
        this.startY = 0;
        this.isEdgeSwipe = false;
        this.edgeType = null; // 'left', 'right', 'bottom'

        // Sesle Yazma (Web Speech Recognition)
        this.recognition = null;
        this.isListening = false;
        this.initSpeechRecognition();

        this.initGestures();
        this.initKeyboard();
        this.initNumpadAndMacros();
        this.initBottomSettings();
    }

    // Kenardan cekme (Edge Swipe) jestlerini dinle
    initGestures() {
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            const w = window.innerWidth;
            const h = window.innerHeight;

            this.startX = x;
            this.startY = y;
            this.isEdgeSwipe = false;
            this.edgeType = null;

            // Sol kenardan basladiysa (< 28px)
            if (x < 28 && !this.activeDrawer) {
                this.isEdgeSwipe = true;
                this.edgeType = 'left';
            }
            // Sag kenardan basladiysa (> w - 28px)
            else if (x > w - 28 && !this.activeDrawer) {
                this.isEdgeSwipe = true;
                this.edgeType = 'right';
            }
            // Alt kenardan basladiysa (> h - 28px)
            else if (y > h - 28 && !this.activeDrawer) {
                this.isEdgeSwipe = true;
                this.edgeType = 'bottom';
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!this.isEdgeSwipe || !this.edgeType) return;
            const curX = e.touches[0].clientX;
            const curY = e.touches[0].clientY;

            const dx = curX - this.startX;
            const dy = curY - this.startY;

            // Yeterince cekildiyse cekmeceyi ac
            if (this.edgeType === 'left' && dx > 50) {
                this.openDrawer('left');
                this.isEdgeSwipe = false;
            } else if (this.edgeType === 'right' && dx < -50) {
                this.openDrawer('right');
                this.isEdgeSwipe = false;
            } else if (this.edgeType === 'bottom' && dy < -50) {
                this.openDrawer('bottom');
                this.isEdgeSwipe = false;
            }
        }, { passive: true });

        // Karartma arkaligina tiklayinca cekmeceleri kapat
        if (this.backdrop) {
            this.backdrop.addEventListener('click', () => this.closeAllDrawers());
        }

        // Cekmece kapatma butonlari
        document.querySelectorAll('.drawer-close-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllDrawers());
        });

        // Manuel acma kulakciklari / butonlari
        const btnLeft = document.getElementById('open-drawer-left-btn');
        const btnRight = document.getElementById('open-drawer-right-btn');
        const btnBottom = document.getElementById('open-drawer-bottom-btn');

        if (btnLeft) btnLeft.addEventListener('click', () => this.openDrawer('left'));
        if (btnRight) btnRight.addEventListener('click', () => this.openDrawer('right'));
        if (btnBottom) btnBottom.addEventListener('click', () => this.openDrawer('bottom'));
    }

    openDrawer(type) {
        this.closeAllDrawers();
        let target = null;
        if (type === 'left') target = this.leftDrawer;
        else if (type === 'right') target = this.rightDrawer;
        else if (type === 'bottom') target = this.bottomDrawer;

        if (target) {
            target.classList.add('open');
            if (this.backdrop) this.backdrop.classList.add('active');
            this.activeDrawer = target;
            window.haptics.modeSwitch();
        }
    }

    closeAllDrawers() {
        if (this.leftDrawer) this.leftDrawer.classList.remove('open');
        if (this.rightDrawer) this.rightDrawer.classList.remove('open');
        if (this.bottomDrawer) this.bottomDrawer.classList.remove('open');
        if (this.backdrop) this.backdrop.classList.remove('active');
        this.activeDrawer = null;
    }

    // === SOL CEKMECE: KLAVYE & SESLE YAZMA ===
    initKeyboard() {
        // Sanal Klavye tuslari
        document.querySelectorAll('.virtual-key').forEach(key => {
            key.addEventListener('click', () => {
                const k = key.getAttribute('data-key');
                if (k) {
                    window.app.send({ type: 'key', key: k });
                    window.haptics.click();
                }
            });
        });

        // Klavye girdi kutusu (Serbest yazi yazma)
        const freeInput = document.getElementById('free-text-input');
        const sendTextBtn = document.getElementById('send-text-btn');

        if (sendTextBtn && freeInput) {
            sendTextBtn.addEventListener('click', () => {
                const txt = freeInput.value;
                if (txt) {
                    window.app.send({ type: 'type', text: txt });
                    freeInput.value = '';
                    window.haptics.success();
                }
            });
            freeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    sendTextBtn.click();
                }
            });
        }

        // Pano / Hizli Yapistirma butonlari
        document.querySelectorAll('.clip-item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-clip-text');
                if (text) {
                    window.app.send({ type: 'type', text: text });
                    window.haptics.click();
                }
            });
        });

        // Sesle Yazma (Speech-to-Text) Butonu
        const voiceBtn = document.getElementById('voice-type-btn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                this.toggleVoiceTyping();
            });
        }
    }

    // Web Speech API ile mikrofon uzerinden ses tanima
    initSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            console.log('Bu tarayicida Web Speech API destegi yok.');
            return;
        }

        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'tr-TR'; // Varsayilan Turkce, ingilizceyi de anlar

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateVoiceUi(true);
            window.haptics.modeSwitch();
        };

        this.recognition.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) {
                    const transcript = e.results[i][0].transcript.trim() + ' ';
                    console.log('[Sesle Yazma]:', transcript);
                    window.app.send({ type: 'type', text: transcript });
                    window.haptics.click();
                }
            }
        };

        this.recognition.onerror = (err) => {
            console.log('Ses tanima hatasi:', err.error);
            this.isListening = false;
            this.updateVoiceUi(false);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateVoiceUi(false);
        };
    }

    toggleVoiceTyping() {
        if (!this.recognition) {
            alert('Sesle yazma tarayıcınızda desteklenmiyor veya mikrofon izni verilmedi.');
            return;
        }

        if (this.isListening) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (e) {
                console.log('Ses tanima baslatilamadi:', e);
            }
        }
    }

    updateVoiceUi(active) {
        const voiceBtn = document.getElementById('voice-type-btn');
        const voiceWave = document.getElementById('voice-status-indicator');
        if (voiceBtn) {
            if (active) voiceBtn.classList.add('recording');
            else voiceBtn.classList.remove('recording');
        }
        if (voiceWave) {
            voiceWave.style.display = active ? 'block' : 'none';
        }
    }

    // === SAG CEKMECE: NUMPAD & MAKROLAR ===
    initNumpadAndMacros() {
        // Numpad butonlari
        document.querySelectorAll('.numpad-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const key = btn.getAttribute('data-num-key');
                if (key) {
                    window.app.send({ type: 'key', key: key });
                    window.haptics.click();
                }
            });
        });

        // Makro Butonlari (Copy, Paste, Snipping tool vb.)
        document.querySelectorAll('.macro-palette-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const keys = btn.getAttribute('data-keys').split('+');
                window.app.send({ type: 'macro', keys: keys });
                window.haptics.success();
            });
        });
    }

    // === ALT CEKMECE: MONITOR SECICI & AYARLAR ===
    initBottomSettings() {
        // DPI Hassasiyet Kaydiraci
        const dpiSlider = document.getElementById('quick-dpi-slider');
        const dpiValText = document.getElementById('quick-dpi-value');
        if (dpiSlider) {
            dpiSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                if (dpiValText) dpiValText.textContent = `${val.toFixed(1)}x`;
                if (window.airMouse) window.airMouse.sensitivity = val * 1.6;
            });
        }

        // Monitor Isinlanma Butonlari (Monitor Jump Buttons)
        document.querySelectorAll('.monitor-jump-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const monId = tab.getAttribute('data-mon-id');
                window.app.send({ type: 'monitor_jump', monitorId: parseInt(monId) });
                window.haptics.monitorJump();
                this.updateActiveMonitorBadge(monId);
            });
        });
    }

    // Monitor butonunu aktif olarak vurgula
    updateActiveMonitorBadge(monId) {
        document.querySelectorAll('.monitor-jump-tab').forEach(tab => {
            if (tab.getAttribute('data-mon-id') === String(monId)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
}

window.edgeDrawers = new EdgeDrawersManager();
