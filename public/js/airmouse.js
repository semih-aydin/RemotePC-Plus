// Universal Wireless Control Hub - Gelismis Lazer, Telemetri ve 1 Euro Filtre Motoru
// Canli Sensor Analizi, Otomatik Aralık Algılama (Auto-Range) ve Dusuk Gecikmeli Isinlama

class OneEuroFilter {
    constructor(freq = 60, minCutoff = 0.5, beta = 0.04, dCutoff = 1.0) {
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

    filter(x, timestamp = performance.now() / 1000) {
        if (this.tPrev === null) {
            this.tPrev = timestamp;
            this.xPrev = x;
            this.dxPrev = 0;
            return x;
        }

        const dt = Math.max(0.001, timestamp - this.tPrev);
        this.tPrev = timestamp;

        const dx = (x - this.xPrev) / dt;
        const alphaD = this.alpha(this.dCutoff, dt);
        const dxHat = alphaD * dx + (1 - alphaD) * this.dxPrev;
        this.dxPrev = dxHat;

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
        this.mode = 'laser'; // 'laser' (mutlak lazer) veya 'relative' (goreli yumusak)

        // Manuel Kalibrasyon
        this.calibLeft = null;
        this.calibRight = null;
        this.isCalibrated = false;

        // Otomatik Aralık Algılama (Auto-Range Tracking)
        this.sweepMinYaw = Infinity;
        this.sweepMaxYaw = -Infinity;
        this.sweepMinPitch = Infinity;
        this.sweepMaxPitch = -Infinity;

        // 1 Euro Titreme Önleme Filtresi
        this.filterX = new OneEuroFilter(60, 0.4, 0.05, 1.0);
        this.filterY = new OneEuroFilter(60, 0.4, 0.05, 1.0);

        // Sanal Masaüstü Sınırları
        this.screenBounds = { minX: 0, maxX: 1920, minY: 0, maxY: 1080, width: 1920, height: 1080 };

        // Telemetri ve İstatistikler
        this.sampleBuffer = [];
        this.packetCounter = 0;
        this.fpsCounter = 0;
        this.lastFpsTime = performance.now();
        this.currentFps = 0;

        this.lastBeta = null;
        this.lastGamma = null;
        this.lastAlpha = null;

        this.loadSavedCalibration();
        this.init();
    }

    init() {
        // Kalibrasyon Butonları
        const btnSetLeft = document.getElementById('calib-set-left');
        const btnSetRight = document.getElementById('calib-set-right');
        const btnResetCalib = document.getElementById('calib-reset-btn');
        const btnAutoRange = document.getElementById('btn-apply-autorange');
        const btnSendTelemetry = document.getElementById('btn-send-telemetry');
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
        if (btnAutoRange) {
            btnAutoRange.addEventListener('click', () => this.applyAutoRange());
        }
        if (btnSendTelemetry) {
            btnSendTelemetry.addEventListener('click', () => this.sendTelemetryToServer());
        }
        if (modeToggle) {
            modeToggle.addEventListener('change', (e) => {
                this.mode = e.target.value;
                this.filterX.reset();
                this.filterY.reset();
            });
        }

        // Sensör Olaylarını Dinle
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
        window.addEventListener('deviceorientationabsolute', (e) => this.handleOrientation(e), true);
    }

    // Ekran Sınırlarını Güncelle
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
    }

    // Kalibrasyon Noktası Kaydet
    recordCalibrationPoint(side) {
        if (this.lastGamma === null || this.lastBeta === null) {
            alert('Sensör verisi bekleniyor. Lütfen telefonu hafifçe hareket ettirin.');
            return;
        }

        const currentYaw = this.lastGamma;
        const currentPitch = this.lastBeta;

        if (side === 'left') {
            this.calibLeft = { yaw: currentYaw, pitch: currentPitch };
            const ind = document.getElementById('calib-left-indicator');
            if (ind) ind.textContent = `✓ ${currentYaw.toFixed(1)}°`;
        } else if (side === 'right') {
            this.calibRight = { yaw: currentYaw, pitch: currentPitch };
            const ind = document.getElementById('calib-right-indicator');
            if (ind) ind.textContent = `✓ ${currentYaw.toFixed(1)}°`;
        }

        if (this.calibLeft && this.calibRight) {
            this.isCalibrated = true;
            this.saveCalibration();
            const statusBox = document.getElementById('calib-status-box');
            if (statusBox) statusBox.textContent = '🎉 Lazer Kalibrasyonu Başarılı!';
            window.haptics.success();
        } else {
            window.haptics.click();
        }
    }

    // Gezinilen doğal açı aralığından otomatik kalibrasyon yap
    applyAutoRange() {
        if (this.sweepMinYaw === Infinity || this.sweepMaxYaw === -Infinity) {
            alert('Henüz yeterli gezinme verisi toplanmadı. Lütfen telefonu sol ve sağ ekranlar arasında gezdirin.');
            return;
        }

        this.calibLeft = { yaw: this.sweepMinYaw, pitch: (this.sweepMinPitch + this.sweepMaxPitch) / 2 };
        this.calibRight = { yaw: this.sweepMaxYaw, pitch: (this.sweepMinPitch + this.sweepMaxPitch) / 2 };
        this.isCalibrated = true;
        this.saveCalibration();

        const indL = document.getElementById('calib-left-indicator');
        const indR = document.getElementById('calib-right-indicator');
        const statusBox = document.getElementById('calib-status-box');

        if (indL) indL.textContent = `✓ Oto ${this.sweepMinYaw.toFixed(1)}°`;
        if (indR) indR.textContent = `✓ Oto ${this.sweepMaxYaw.toFixed(1)}°`;
        if (statusBox) statusBox.textContent = `🎉 Otomatik Aralık Uygulandı: ${this.sweepMinYaw.toFixed(1)}° ile ${this.sweepMaxYaw.toFixed(1)}° arası`;

        window.haptics.success();
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
        this.sweepMinYaw = Infinity;
        this.sweepMaxYaw = -Infinity;
        this.sweepMinPitch = Infinity;
        this.sweepMaxPitch = -Infinity;

        try {
            localStorage.removeItem('laser_calib_left');
            localStorage.removeItem('laser_calib_right');
        } catch (e) {}

        const indL = document.getElementById('calib-left-indicator');
        const indR = document.getElementById('calib-right-indicator');
        const statusBox = document.getElementById('calib-status-box');

        if (indL) indL.textContent = 'Kaydedilmedi';
        if (indR) indR.textContent = 'Kaydedilmedi';
        if (statusBox) statusBox.textContent = 'Kalibre edilmedi. 1 ve 2. adımları yapın veya otomatik aralığı kullanın.';
        window.haptics.click();
    }

    handleOrientation(e) {
        if (!this.active) return;
        if (e.beta === null || e.gamma === null) return;

        this.packetCounter++;
        this.fpsCounter++;

        const now = performance.now();
        if (now - this.lastFpsTime >= 1000) {
            this.currentFps = this.fpsCounter;
            this.fpsCounter = 0;
            this.lastFpsTime = now;
        }

        this.lastBeta = e.beta;
        this.lastGamma = e.gamma;
        this.lastAlpha = e.alpha;

        const curYaw = e.gamma;
        const curPitch = e.beta;

        // Otomatik Gezinme Aralığını Güncelle
        if (curYaw < this.sweepMinYaw) this.sweepMinYaw = curYaw;
        if (curYaw > this.sweepMaxYaw) this.sweepMaxYaw = curYaw;
        if (curPitch < this.sweepMinPitch) this.sweepMinPitch = curPitch;
        if (curPitch > this.sweepMaxPitch) this.sweepMaxPitch = curPitch;

        // Telemetri Örneği Kaydet (Son 100 örnek)
        if (this.sampleBuffer.length > 100) this.sampleBuffer.shift();
        this.sampleBuffer.push({
            t: Math.round(now),
            yaw: parseFloat(curYaw.toFixed(2)),
            pitch: parseFloat(curPitch.toFixed(2))
        });

        // === 1. MUTLAK LAZER MODU ===
        if (this.mode === 'laser' && this.isCalibrated && this.calibLeft && this.calibRight) {
            const leftYaw = this.calibLeft.yaw;
            const rightYaw = this.calibRight.yaw;
            const yawSpan = rightYaw - leftYaw;

            if (Math.abs(yawSpan) > 2) {
                let tX = (curYaw - leftYaw) / yawSpan;
                tX = Math.max(-0.02, Math.min(1.02, tX));

                const centerPitch = (this.calibLeft.pitch + this.calibRight.pitch) / 2;
                const pitchSpan = 28.0;
                let tY = (curPitch - (centerPitch - pitchSpan / 2)) / pitchSpan;
                tY = Math.max(-0.02, Math.min(1.02, tY));

                const rawTargetX = this.screenBounds.minX + tX * this.screenBounds.width;
                const rawTargetY = this.screenBounds.minY + tY * this.screenBounds.height;

                const nowSec = now / 1000;
                const filteredX = this.filterX.filter(rawTargetX, nowSec);
                const filteredY = this.filterY.filter(rawTargetY, nowSec);

                if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
                    window.app.send({
                        type: 'move_abs',
                        x: filteredX,
                        y: filteredY,
                        yaw: curYaw,
                        pitch: curPitch,
                        t: Date.now()
                    });
                }

                this.renderLiveHud(curYaw, curPitch, filteredX, filteredY);
                return;
            }
        }

        // === 2. GÖRELİ MOD ===
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

        if (Math.hypot(dYaw, dPitch) < 0.03) return;

        const nowSec = now / 1000;
        const smoothDx = this.filterX.filter(dYaw * 32.0, nowSec);
        const smoothDy = this.filterY.filter(dPitch * 32.0, nowSec);

        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: smoothDx,
                dy: smoothDy,
                t: Date.now()
            });
        }

        this.renderLiveHud(curYaw, curPitch);
    }

    // Canlı Telemetri HUD Paneli
    renderLiveHud(yaw, pitch, targetX = null, targetY = null) {
        const hudAngles = document.getElementById('hud-angles');
        const hudTarget = document.getElementById('hud-target');
        const hudRange = document.getElementById('hud-range');
        const hudRate = document.getElementById('hud-rate');

        if (hudAngles) {
            hudAngles.textContent = `Açı (Yaw / Pitch): ${yaw.toFixed(1)}° / ${pitch.toFixed(1)}°`;
        }
        if (hudTarget) {
            if (targetX !== null && targetY !== null) {
                hudTarget.textContent = `Hedef Piksel: (${Math.round(targetX)}, ${Math.round(targetY)})`;
            } else {
                hudTarget.textContent = `Mod: Göreli Yumuşak`;
            }
        }
        if (hudRange) {
            const minStr = this.sweepMinYaw !== Infinity ? this.sweepMinYaw.toFixed(1) : '0';
            const maxStr = this.sweepMaxYaw !== -Infinity ? this.sweepMaxYaw.toFixed(1) : '0';
            const spanStr = (this.sweepMaxYaw !== -Infinity && this.sweepMinYaw !== Infinity) ? (this.sweepMaxYaw - this.sweepMinYaw).toFixed(1) : '0';
            hudRange.textContent = `Gezinme Aralığı: [${minStr}° ➔ ${maxStr}°] (${spanStr}° genişlik)`;
        }
        if (hudRate) {
            hudRate.textContent = `Örnek Hızı: ${this.currentFps} FPS | Paket: ${this.packetCounter}`;
        }
    }

    // Toplu Telemetriyi Sunucuya Gönder
    async sendTelemetryToServer() {
        try {
            const res = await fetch('/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    samples: this.sampleBuffer,
                    screenBounds: this.screenBounds,
                    calibLeft: this.calibLeft,
                    calibRight: this.calibRight,
                    sweepRange: { minYaw: this.sweepMinYaw, maxYaw: this.sweepMaxYaw }
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Telemetri sunucuya kaydedildi! (${this.sampleBuffer.length} örnek)`);
                window.haptics.success();
            }
        } catch (e) {
            alert('Telemetri gönderilemedi: ' + e.message);
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
