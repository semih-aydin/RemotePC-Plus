// Air Mouse - Guclendirilmis Jiroskop ve Sensor Motoru
// DeviceOrientation, DeviceMotion ve W3C Generic Sensor API (Gyroscope/OrientationSensor) destekler

class AirMouseController {
    constructor() {
        this.active = false;
        this.isTracking = true;

        this.lastBeta = null;
        this.lastGamma = null;
        this.lastAlpha = null;

        // Hassasiyet
        this.sensitivity = 3.5;
        this.deadZone = 0.03;

        this.eventCount = 0;
        this.genericSensor = null;

        this.init();
    }

    init() {
        const sensSlider = document.getElementById('airmouse-sens-slider');
        const sensVal = document.getElementById('airmouse-sens-val');
        const startBtn = document.getElementById('start-gyro-btn');
        const recenterBtn = document.getElementById('recenter-btn');

        if (sensSlider) {
            sensSlider.addEventListener('input', (e) => {
                this.sensitivity = parseFloat(e.target.value);
                if (sensVal) sensVal.textContent = `${this.sensitivity.toFixed(1)}x`;
            });
        }

        if (startBtn) {
            startBtn.addEventListener('click', async () => {
                await this.requestAndStartSensors();
            });
        }

        if (recenterBtn) {
            recenterBtn.addEventListener('click', () => {
                this.resetReference();
            });
        }

        // Sayfa acildiginda da otomatik dinleyicileri ekle
        this.bindEvents();
    }

    // Tum sensor olaylarini bagla
    bindEvents() {
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
        window.addEventListener('deviceorientationabsolute', (e) => this.handleOrientation(e), true);
        window.addEventListener('devicemotion', (e) => this.handleMotion(e), true);
    }

    // Sensor izinlerini iste ve baslat
    async requestAndStartSensors() {
        const statusEl = document.getElementById('sensor-status-msg');
        if (statusEl) statusEl.textContent = 'Sensörler başlatılıyor...';

        // 1. iOS Safari Izin Kontrolu
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const perm = await DeviceOrientationEvent.requestPermission();
                if (perm === 'granted') {
                    if (statusEl) statusEl.textContent = 'Sensör izni verildi (iOS).';
                    this.bindEvents();
                } else {
                    if (statusEl) statusEl.textContent = 'Sensör izni reddedildi.';
                }
            } catch (err) {
                if (statusEl) statusEl.textContent = 'İzin hatası: ' + err.message;
            }
        }

        // 2. Generic Sensor API (Modern Android Chrome)
        try {
            if ('RelativeOrientationSensor' in window) {
                this.genericSensor = new RelativeOrientationSensor({ frequency: 60 });
                this.genericSensor.addEventListener('reading', () => {
                    const q = this.genericSensor.quaternion;
                    // Quaternion'dan Euler acilarina (Pitch/Roll) donustur
                    if (q) {
                        const roll = Math.atan2(2 * (q[0]*q[1] + q[2]*q[3]), 1 - 2 * (q[1]*q[1] + q[2]*q[2])) * (180 / Math.PI);
                        const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (q[0]*q[2] - q[3]*q[1])))) * (180 / Math.PI);
                        this.processAngles(pitch, roll);
                    }
                });
                this.genericSensor.start();
                if (statusEl) statusEl.textContent = 'Generic Sensor aktif!';
            }
        } catch (e) {
            console.log('Generic sensor baslatilamadi, DeviceOrientation kullanilacak');
        }

        this.resetReference();
    }

    resetReference() {
        this.lastBeta = null;
        this.lastGamma = null;
        this.lastAlpha = null;
    }

    // DeviceOrientation verisi gelince
    handleOrientation(e) {
        if (!this.active) return;
        if (e.beta === null || e.gamma === null) return;
        this.processAngles(e.beta, e.gamma);
    }

    // Açı farklarını hesaplayıp fareyi hareket ettir
    processAngles(beta, gamma) {
        this.eventCount++;
        this.updateDebugDisplay(beta, gamma);

        if (this.lastBeta === null || this.lastGamma === null) {
            this.lastBeta = beta;
            this.lastGamma = gamma;
            return;
        }

        let dBeta = beta - this.lastBeta;
        let dGamma = gamma - this.lastGamma;

        this.lastBeta = beta;
        this.lastGamma = gamma;

        if (Math.abs(dBeta) > 80) dBeta = 0;
        if (Math.abs(dGamma) > 80) dGamma = 0;

        let rawDx = dGamma;
        let rawDy = dBeta;

        const speed = Math.hypot(rawDx, rawDy);
        if (speed < this.deadZone) return;

        let multiplier = this.sensitivity * 9.0;
        if (speed > 2.0) {
            multiplier *= Math.pow(speed / 2.0, 0.45);
        }

        const finalDx = rawDx * multiplier;
        const finalDy = rawDy * multiplier;

        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: finalDx,
                dy: finalDy,
                t: Date.now()
            });
        }
    }

    // Devicemotion (rotationRate fallback)
    handleMotion(e) {
        if (!this.active || this.eventCount > 0) return;
        const rot = e.rotationRate;
        if (rot && (rot.beta !== null || rot.gamma !== null)) {
            const dy = (rot.beta || 0) * this.sensitivity * 1.5;
            const dx = (rot.gamma || 0) * this.sensitivity * 1.5;

            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
                    window.app.send({ type: 'move', dx: dx, dy: dy, t: Date.now() });
                }
            }
        }
    }

    updateDebugDisplay(beta, gamma) {
        const stats = document.getElementById('gyro-debug-text');
        if (stats) {
            stats.textContent = `X: ${gamma.toFixed(1)}° | Y: ${beta.toFixed(1)}° | Paket: ${this.eventCount}`;
        }
    }

    setActive(isActive) {
        this.active = isActive;
        if (isActive) {
            this.resetReference();
            this.requestAndStartSensors();

            // Guvenli context kontrolu (HTTPS gerekli mi?)
            const httpsWarning = document.getElementById('https-warning-box');
            if (httpsWarning) {
                if (!window.isSecureContext && location.protocol !== 'https:') {
                    httpsWarning.style.display = 'block';
                } else {
                    httpsWarning.style.display = 'none';
                }
            }
        }
    }
}

window.airMouse = new AirMouseController();
