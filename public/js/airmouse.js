// Universal Wireless Control Hub - Lazer Kumanda ve Uzamsal Kalibrasyon Motoru (Laser Pointer Engine)
// 1 Euro (1€) Titreme Engelleyici Filtre ve Coklu Monitor Uzamsal Isinlama (Raycasting)

class OneEuroFilter {
    constructor(freq = 60, minCutoff = 0.8, beta = 0.05, dCutoff = 1.0) {
        this.freq = freq;
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
        this.xPrev = null;
        this.dxPrev = 0;
        this.tPrev = null;
    }

    alpha(cutoff, dt) {
        const tau = 1.0 / (2 * Math.PI * cutoff);
        return 1.0 / (1.0 + tau / dt);
    }

    filter(x, timestamp = Date.now() / 1000) {
        if (this.tPrev === null) {
            this.tPrev = timestamp;
            this.xPrev = x;
            this.dxPrev = 0;
            return x;
        }

        const dt = Math.max(0.001, timestamp - this.tPrev);
        this.tPrev = timestamp;

        // Hiz degisimi
        const dx = (x - this.xPrev) / dt;
        const alphaD = this.alpha(this.dCutoff, dt);
        const dxHat = alphaD * dx + (1 - alphaD) * this.dxPrev;
        this.dxPrev = dxHat;

        // Dinamik Cutoff (Yavas harekette yuksek filtreleme / sifir titreme; hizlida sifir gecikme)
        const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
        const alpha = this.alpha(cutoff, dt);
        const xHat = alpha * x + (1 - alpha) * this.xPrev;
        this.xPrev = xHat;

        return xHat;
    }

    reset() {
        this.xPrev = null;
        this.tPrev = null;
        this.dxPrev = 0;
    }
}

class AirMouseController {
    constructor() {
        this.active = false;
        this.mode = 'laser'; // 'laser' (mutlak lazer isareti) veya 'relative' (goreli yumusak)

        // Kalibrasyon Noktalari (Sol ve Sag Sinir Acilari)
        this.calibLeft = null;   // { yaw, pitch }
        this.calibRight = null;  // { yaw, pitch }
        this.isCalibrated = false;

        // 1 Euro Filtreleri (X ve Y icin titreme onleyici)
        this.filterX = new OneEuroFilter(60, 0.6, 0.08, 1.0);
        this.filterY = new OneEuroFilter(60, 0.6, 0.08, 1.0);

        // Sanal Masaustu Sinirlari
        this.screenBounds = { minX: 0, maxX: 1920, minY: 0, maxY: 1080, width: 1920, height: 1080 };

        this.lastBeta = null;
        this.lastGamma = null;
        this.lastAlpha = null;

        this.loadSavedCalibration();
        this.init();
    }

    init() {
        // Kalibrasyon Butonlari
        const btnSetLeft = document.getElementById('calib-set-left');
        const btnSetRight = document.getElementById('calib-set-right');
        const btnResetCalib = document.getElementById('calib-reset-btn');
        const modeToggle = document.getElementById('laser-mode-select');

        if (btnSetLeft) {
            btnSetLeft.addEventListener('click', () => this.recordCalibrationPoint('left'));
        }
        if (btnSetRight) {
            btnSetRight.addEventListener('click', () => this.recordCalibrationPoint('right'));
        }
        if (btnResetCalib) {
            btnResetCalib.addEventListener('click', () => this.resetCalibration());
        }
        if (modeToggle) {
            modeToggle.addEventListener('change', (e) => {
                this.mode = e.target.value;
                this.filterX.reset();
                this.filterY.reset();
            });
        }

        // Sensor Olaylari
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
        window.addEventListener('deviceorientationabsolute', (e) => this.handleOrientation(e), true);
    }

    // Coklu monitor toplam cozunurlugunu hesapla
    updateScreenBounds(monitors) {
        if (!monitors || monitors.length === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        monitors.forEach(m => {
            if (m.x < minX) minX = m.x;
            if (m.y < minY) minY = m.y;
            if (m.x + m.width > maxX) maxX = m.x + m.width;
            if (m.y + m.height > maxY) maxY = m.y + m.height;
        });

        this.screenBounds = {
            minX, minY, maxX, maxY,
            width: maxX - minX || 1920,
            height: maxY - minY || 1080
        };
        console.log('[LaserPointer] Ekran sinirlari guncellendi:', this.screenBounds);
    }

    // Kalibrasyon Noktasi Kaydet
    recordCalibrationPoint(side) {
        if (this.lastGamma === null || this.lastBeta === null) {
            alert('Henüz sensör verisi alınamadı. Telefonu hafifçe hareket ettirin.');
            return;
        }

        // Yaw icin gamma veya alpha kullanalim
        const currentYaw = this.lastGamma;
        const currentPitch = this.lastBeta;

        if (side === 'left') {
            this.calibLeft = { yaw: currentYaw, pitch: currentPitch };
            const ind = document.getElementById('calib-left-indicator');
            if (ind) ind.textContent = `✓ Kaydedildi (${currentYaw.toFixed(1)}°)`;
        } else if (side === 'right') {
            this.calibRight = { yaw: currentYaw, pitch: currentPitch };
            const ind = document.getElementById('calib-right-indicator');
            if (ind) ind.textContent = `✓ Kaydedildi (${currentYaw.toFixed(1)}°)`;
        }

        if (this.calibLeft && this.calibRight) {
            this.isCalibrated = true;
            this.saveCalibration();
            const statusBox = document.getElementById('calib-status-box');
            if (statusBox) statusBox.textContent = '🎉 Lazer Kalibrasyonu Başarılı! Telefon artık bir lazer gibi çalışıyor.';
            window.haptics.success();
        } else {
            window.haptics.click();
        }
    }

    saveCalibration() {
        try {
            localStorage.setItem('laser_calib_left', JSON.stringify(this.calibLeft));
            localStorage.setItem('laser_calib_right', JSON.stringify(this.calibRight));
        } catch (e) {}
    }

    loadSavedCalibration() {
        try {
            const l = localStorage.getItem('laser_calib_left');
            const r = localStorage.getItem('laser_calib_right');
            if (l && r) {
                this.calibLeft = JSON.parse(l);
                this.calibRight = JSON.parse(r);
                this.isCalibrated = true;
            }
        } catch (e) {}
    }

    resetCalibration() {
        this.calibLeft = null;
        this.calibRight = null;
        this.isCalibrated = false;
        try {
            localStorage.removeItem('laser_calib_left');
            localStorage.removeItem('laser_calib_right');
        } catch (e) {}

        const indL = document.getElementById('calib-left-indicator');
        const indR = document.getElementById('calib-right-indicator');
        const statusBox = document.getElementById('calib-status-box');

        if (indL) indL.textContent = 'Kaydedilmedi';
        if (indR) indR.textContent = 'Kaydedilmedi';
        if (statusBox) statusBox.textContent = 'Kalibre edilmedi. Lütfen 1 ve 2. adımları tamamlayın.';
        window.haptics.click();
    }

    handleOrientation(e) {
        if (!this.active) return;
        if (e.beta === null || e.gamma === null) return;

        this.lastBeta = e.beta;
        this.lastGamma = e.gamma;
        this.lastAlpha = e.alpha;

        const curYaw = e.gamma;  // Saga / Sola acisal donus
        const curPitch = e.beta; // Yukari / Asagi acisal donus

        // === 1. MUTLAK LAZER MODU (Absolute Raycasting) ===
        if (this.mode === 'laser' && this.isCalibrated && this.calibLeft && this.calibRight) {
            const leftYaw = this.calibLeft.yaw;
            const rightYaw = this.calibRight.yaw;
            const yawSpan = rightYaw - leftYaw;

            if (Math.abs(yawSpan) > 2) {
                // X ekseni oransal konumu (0.0: Sol Ekran Sınırı, 1.0: Sağ Ekran Sınırı)
                let tX = (curYaw - leftYaw) / yawSpan;
                tX = Math.max(-0.05, Math.min(1.05, tX)); // Hafif tasmaya izin ver

                // Y ekseni (Yukari - Asagi egim: ornek 35 derece dikey aci araligi)
                const centerPitch = (this.calibLeft.pitch + this.calibRight.pitch) / 2;
                const pitchSpan = 30.0; // Dikeyde 30 derecelik acisal alan
                let tY = (curPitch - (centerPitch - pitchSpan / 2)) / pitchSpan;
                tY = Math.max(-0.05, Math.min(1.05, tY));

                // Ham hedef koordinat
                const rawTargetX = this.screenBounds.minX + tX * this.screenBounds.width;
                const rawTargetY = this.screenBounds.minY + tY * this.screenBounds.height;

                // 1 Euro Filtresi ile titremeyi SIFIRA indir
                const nowSec = Date.now() / 1000;
                const filteredX = this.filterX.filter(rawTargetX, nowSec);
                const filteredY = this.filterY.filter(rawTargetY, nowSec);

                // Sunucuya mutlak koordinat (move_abs) gonder
                if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
                    window.app.send({
                        type: 'move_abs',
                        x: filteredX,
                        y: filteredY,
                        t: Date.now()
                    });
                }

                this.updateDebugUi(curYaw, curPitch, filteredX, filteredY);
                return;
            }
        }

        // === 2. GORELI MOD (Relative Smooth Fallback) ===
        if (this.lastYawRel === undefined) {
            this.lastYawRel = curYaw;
            this.lastPitchRel = curPitch;
            return;
        }

        let dYaw = curYaw - this.lastYawRel;
        let dPitch = curPitch - this.lastPitchRel;
        this.lastYawRel = curYaw;
        this.lastPitchRel = curPitch;

        if (Math.abs(dYaw) > 80) dYaw = 0;
        if (Math.abs(dPitch) > 80) dPitch = 0;

        if (Math.hypot(dYaw, dPitch) < 0.04) return;

        const nowSec = Date.now() / 1000;
        const smoothDx = this.filterX.filter(dYaw * 28.0, nowSec);
        const smoothDy = this.filterY.filter(dPitch * 28.0, nowSec);

        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: smoothDx,
                dy: smoothDy,
                t: Date.now()
            });
        }

        this.updateDebugUi(curYaw, curPitch);
    }

    updateDebugUi(yaw, pitch, targetX = null, targetY = null) {
        const debugText = document.getElementById('laser-debug-text');
        if (debugText) {
            if (targetX !== null && targetY !== null) {
                debugText.textContent = `Açı: ${yaw.toFixed(1)}° | Hedef: (${Math.round(targetX)}, ${Math.round(targetY)})`;
            } else {
                debugText.textContent = `Açı: Yaw=${yaw.toFixed(1)}° Pitch=${pitch.toFixed(1)}°`;
            }
        }
    }

    setActive(isActive) {
        this.active = isActive;
        if (isActive) {
            this.filterX.reset();
            this.filterY.reset();
            this.lastYawRel = undefined;
            if (window.app && window.app.monitors) {
                this.updateScreenBounds(window.app.monitors);
            }
        }
    }
}

window.airMouse = new AirMouseController();
