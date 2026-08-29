// Air Mouse (Jiroskop / Hareket Tabanli 3D Fare Motoru)
// Telefonun tum hareket sensorlerini (orientation + motion) kullanarak imleci yonetir

class AirMouseController {
    constructor() {
        this.active = false;
        this.trackingMode = 'continuous'; // 'continuous' (surekli takip) veya 'clutch' (tutunca hareket)
        this.isClutched = true; // continuous modda varsayilan true

        this.lastBeta = null;
        this.lastGamma = null;
        this.lastAlpha = null;

        // Hassasiyet ve filtreleme
        this.sensitivity = 3.2; // Varsayilan akici ve hizli hassasiyet
        this.deadZone = 0.04;   // El titremesini kesmek icin minimum olu bolge
        this.smoothFactor = 0.6; // Dusuk gecikmeli yumusatma

        this.smoothedDx = 0;
        this.smoothedDy = 0;

        // Sensor verisi geliyor mu kontrolu
        this.sensorDataReceived = false;
        this.lastEventTime = 0;

        this.initEvents();
    }

    initEvents() {
        // Debriyaj (Clutch) ve Mod Butonlari
        const clutchBtn = document.getElementById('clutch-btn');
        const recenterBtn = document.getElementById('recenter-btn');
        const modeToggleBtn = document.getElementById('airmouse-mode-toggle');
        const sensSlider = document.getElementById('airmouse-sens-slider');
        const sensLabel = document.getElementById('airmouse-sens-val');
        const permBtn = document.getElementById('sensor-perm-btn');

        // Hassasiyet Kaydiraci
        if (sensSlider) {
            sensSlider.addEventListener('input', (e) => {
                this.sensitivity = parseFloat(e.target.value);
                if (sensLabel) sensLabel.textContent = `${this.sensitivity.toFixed(1)}x`;
            });
        }

        // Surekli Takip / Debriyajli Takip Gecisi
        if (modeToggleBtn) {
            modeToggleBtn.addEventListener('click', () => {
                if (this.trackingMode === 'continuous') {
                    this.trackingMode = 'clutch';
                    this.isClutched = false;
                    modeToggleBtn.innerHTML = '<i class="fas fa-hand-paper"></i> Mod: Tut-ve-Oynat';
                    if (clutchBtn) clutchBtn.style.display = 'flex';
                } else {
                    this.trackingMode === 'continuous';
                    this.isClutched = true;
                    modeToggleBtn.innerHTML = '<i class="fas fa-bolt"></i> Mod: Sürekli Takip';
                    if (clutchBtn) clutchBtn.style.display = 'none';
                }
                window.haptics.modeSwitch();
            });
        }

        // Clutch Butonu Olaylari (Eger debriyaj modundaysa)
        if (clutchBtn) {
            const startClutch = (e) => {
                e.preventDefault();
                this.isClutched = true;
                clutchBtn.classList.add('active');
                window.haptics.clutchEngaged();
                this.resetReference();
            };

            const endClutch = (e) => {
                e.preventDefault();
                this.isClutched = false;
                clutchBtn.classList.remove('active');
                window.haptics.clutchReleased();
            };

            clutchBtn.addEventListener('touchstart', startClutch, { passive: false });
            clutchBtn.addEventListener('touchend', endClutch, { passive: false });
            clutchBtn.addEventListener('touchcancel', endClutch, { passive: false });
            clutchBtn.addEventListener('mousedown', startClutch);
            clutchBtn.addEventListener('mouseup', endClutch);
        }

        // Sifirlama (Recenter)
        if (recenterBtn) {
            recenterBtn.addEventListener('click', () => {
                this.resetReference();
                window.haptics.click();
                const hint = document.getElementById('recenter-hint');
                if (hint) {
                    hint.style.opacity = '1';
                    setTimeout(() => hint.style.opacity = '0', 1000);
                }
            });
        }

        // iOS Sensor Izni Butonu
        if (permBtn) {
            permBtn.addEventListener('click', async () => {
                const granted = await this.requestSensorPermission();
                if (granted) {
                    permBtn.style.display = 'none';
                    window.haptics.success();
                }
            });
        }

        // Olay Dinleyicileri (Hem Orientation hem Absolute hem Motion)
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
        window.addEventListener('deviceorientationabsolute', (e) => this.handleOrientation(e), true);
        window.addEventListener('devicemotion', (e) => this.handleMotion(e), true);
    }

    // iOS 13+ icin jiroskop izni iste
    async requestSensorPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const state = await DeviceOrientationEvent.requestPermission();
                if (state === 'granted') {
                    console.log('Jiroskop izni verildi!');
                    this.resetReference();
                    return true;
                }
            } catch (err) {
                console.log('Sensor izni hatasi:', err);
            }
        }
        return false;
    }

    // Referans acilari sifirla
    resetReference() {
        this.lastBeta = null;
        this.lastGamma = null;
        this.lastAlpha = null;
        this.smoothedDx = 0;
        this.smoothedDy = 0;
    }

    // Orientation Olaylarini Isle (Beta = Pitch, Gamma = Roll)
    handleOrientation(e) {
        if (!this.active) return;

        const beta = e.beta;   // Yukari - Asagi [-180, 180]
        const gamma = e.gamma; // Saga - Sola [-90, 90]
        const alpha = e.alpha; // Pusula [0, 360]

        if (beta === null || gamma === null) return;

        this.sensorDataReceived = true;
        this.updateLiveSensorDisplay(beta, gamma);

        // Ilk referans acisini kaydet
        if (this.lastBeta === null || this.lastGamma === null) {
            this.lastBeta = beta;
            this.lastGamma = gamma;
            this.lastAlpha = alpha;
            return;
        }

        // Aci farklarini hesapla
        let dBeta = beta - this.lastBeta;
        let dGamma = gamma - this.lastGamma;

        this.lastBeta = beta;
        this.lastGamma = gamma;
        this.lastAlpha = alpha;

        // Eger debriyaj aktif degilse fareyi hareket ettirme
        if (!this.isClutched) {
            return;
        }

        // 360 derece donuslerdeki ani ziplamalari engelle
        if (Math.abs(dBeta) > 90) dBeta = 0;
        if (Math.abs(dGamma) > 90) dGamma = 0;

        // X = gamma (yana egme), Y = beta (one/arkaya egme)
        let rawDx = dGamma;
        let rawDy = dBeta;

        const speed = Math.hypot(rawDx, rawDy);

        // 1. Olu Bolge (El titremesini yok et)
        if (speed < this.deadZone) {
            return;
        }

        // 2. Dinamik Ivme (Velocity Scaling)
        let multiplier = this.sensitivity * 8.0;
        if (speed > 2.0) {
            multiplier *= Math.pow(speed / 2.0, 0.4);
        }

        const targetDx = rawDx * multiplier;
        const targetDy = rawDy * multiplier;

        // Yumusatma filtresi
        this.smoothedDx = this.smoothedDx * (1 - this.smoothFactor) + targetDx * this.smoothFactor;
        this.smoothedDy = this.smoothedDy * (1 - this.smoothFactor) + targetDy * this.smoothFactor;

        // Sunucuya Gonder
        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: this.smoothedDx,
                dy: this.smoothedDy,
                t: Date.now()
            });
        }
    }

    // Devicemotion (Gyroscope rotationRate fallback)
    handleMotion(e) {
        if (!this.active || this.sensorDataReceived) return;

        // Orientation calismiyorsa rotationRate ile yonet
        const rot = e.rotationRate;
        if (rot && (rot.alpha !== null || rot.beta !== null || rot.gamma !== null)) {
            const rotX = rot.beta || 0;
            const rotY = rot.gamma || 0;

            if (Math.abs(rotX) > 1 || Math.abs(rotY) > 1) {
                const dx = rotY * this.sensitivity * 1.5;
                const dy = rotX * this.sensitivity * 1.5;

                if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
                    window.app.send({
                        type: 'move',
                        dx: dx,
                        dy: dy,
                        t: Date.now()
                    });
                }
            }
        }
    }

    // Arayuzdeki canli jiroskop gostergesini guncelle
    updateLiveSensorDisplay(beta, gamma) {
        const dot = document.getElementById('gyro-horizon-dot');
        const stats = document.getElementById('gyro-stats-text');

        if (dot) {
            const clampedX = Math.max(-40, Math.min(40, gamma * 2));
            const clampedY = Math.max(-40, Math.min(40, (beta - 45) * 2));
            dot.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
        }

        if (stats) {
            stats.textContent = `Eğim: X:${gamma.toFixed(1)}° Y:${beta.toFixed(1)}°`;
        }
    }

    setActive(isActive) {
        this.active = isActive;
        if (isActive) {
            this.requestSensorPermission();
            this.resetReference();
            // Varsayilan continuous modunda baslasin
            if (this.trackingMode === 'continuous') {
                this.isClutched = true;
            }
        }
    }
}

window.airMouse = new AirMouseController();
