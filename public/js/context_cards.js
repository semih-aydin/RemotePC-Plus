// Contextual Control Cards (Dinamik Arayuz Kartlari)
// Aktif masaustu uygulamasina gore arayuzun sekil degistirmesi (Media, Presentation, Browser, Code)

class ContextCardsManager {
    constructor() {
        this.currentContext = 'desktop';
        this.manualOverride = false; // Kullanici elle bir kart sectiyse otomatik degismeyi durdurabilir

        // Sunum zamanlayicisi (Presentation Timer)
        this.timerInterval = null;
        this.timerSeconds = 0;
        this.isTimerRunning = false;

        this.initEvents();
    }

    initEvents() {
        // Medya Kontrol Butonlari
        document.querySelectorAll('[data-media-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-media-action');
                window.app.send({ type: 'media', action: action });
                window.haptics.click();
            });
        });

        // Ses Seviyesi Cubugu (Volume Slider)
        const volSlider = document.getElementById('media-vol-slider');
        if (volSlider) {
            let lastVol = parseInt(volSlider.value);
            volSlider.addEventListener('input', (e) => {
                const curVol = parseInt(e.target.value);
                const diff = curVol - lastVol;
                if (Math.abs(diff) >= 5) {
                    const action = diff > 0 ? 'vol_up' : 'vol_down';
                    window.app.send({ type: 'media', action: action });
                    window.haptics.scrollDetent();
                    lastVol = curVol;
                }
            });
        }

        // Sunum Kontrol Butonlari
        document.querySelectorAll('[data-pres-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-pres-action');
                window.app.send({ type: 'presentation', action: action });
                window.haptics.click();
            });
        });

        // Sunum Kronometresi (Presentation Timer)
        const timerToggleBtn = document.getElementById('pres-timer-toggle');
        const timerResetBtn = document.getElementById('pres-timer-reset');

        if (timerToggleBtn) {
            timerToggleBtn.addEventListener('click', () => {
                this.togglePresentationTimer();
                window.haptics.click();
            });
        }
        if (timerResetBtn) {
            timerResetBtn.addEventListener('click', () => {
                this.resetPresentationTimer();
                window.haptics.click();
            });
        }

        // Tarayici ve Kodlama Butonlari
        document.querySelectorAll('[data-macro-key]').forEach(btn => {
            btn.addEventListener('click', () => {
                const keys = btn.getAttribute('data-macro-key').split('+');
                window.app.send({ type: 'macro', keys: keys });
                window.haptics.click();
            });
        });
    }

    // Sunucudan gelen context degisimine gore karti degistir
    setContext(newContext, windowTitle = '', processName = '') {
        if (this.manualOverride) return;

        this.currentContext = newContext;
        console.log(`[ContextCard] Yeni mod yuklendi: ${newContext} (${processName})`);

        // Tum context kartlarini gizle
        document.querySelectorAll('.context-card').forEach(card => card.classList.remove('active'));

        // Ilgili karti goster
        const targetCard = document.getElementById(`card-${newContext}`);
        if (targetCard) {
            targetCard.classList.add('active');
            window.haptics.modeSwitch();
        }

        // Baslik ve uygulama bilgisini guncelle
        const titleEl = document.getElementById('context-app-title');
        if (titleEl) {
            titleEl.textContent = windowTitle ? `${processName.toUpperCase()}: ${windowTitle}` : `${processName.toUpperCase()}`;
        }
    }

    // Kullanici elle mod secerse
    setManualContext(contextName) {
        this.manualOverride = (contextName !== 'auto');
        if (contextName === 'auto') {
            this.setContext(window.app.lastContext || 'desktop');
        } else {
            this.setContext(contextName);
        }
    }

    // Sunum Kronometresi Kontrolleri
    togglePresentationTimer() {
        const display = document.getElementById('pres-timer-display');
        const toggleBtn = document.getElementById('pres-timer-toggle');

        if (this.isTimerRunning) {
            clearInterval(this.timerInterval);
            this.isTimerRunning = false;
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-play"></i> Baslat';
        } else {
            this.isTimerRunning = true;
            if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-pause"></i> Durdur';
            this.timerInterval = setInterval(() => {
                this.timerSeconds++;
                const mins = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
                const secs = (this.timerSeconds % 60).toString().padStart(2, '0');
                if (display) display.textContent = `${mins}:${secs}`;
            }, 1000);
        }
    }

    resetPresentationTimer() {
        clearInterval(this.timerInterval);
        this.isTimerRunning = false;
        this.timerSeconds = 0;
        const display = document.getElementById('pres-timer-display');
        const toggleBtn = document.getElementById('pres-timer-toggle');
        if (display) display.textContent = '00:00';
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-play"></i> Baslat';
    }
}

window.contextCards = new ContextCardsManager();
