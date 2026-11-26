// Magnifier Loupe (Imlec Cevresi Büyüteç)
// Bilgisayardaki fare imlecinin etrafindaki alani buyuterek telefonda gosterir

class MagnifierController {
    constructor() {
        this.container = document.getElementById('magnifier-container');
        this.canvas = document.getElementById('magnifier-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.toggleBtn = document.getElementById('magnifier-toggle-btn');
        this.closeBtn = document.getElementById('magnifier-close-btn');

        this.isActive = false;
        this.streamInterval = null;

        this.initEvents();
    }

    initEvents() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.toggle());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.stop());
        }
    }

    toggle() {
        if (this.isActive) this.stop();
        else this.start();
    }

    start() {
        this.isActive = true;
        if (this.container) this.container.classList.add('active');
        if (this.toggleBtn) this.toggleBtn.classList.add('active');
        window.haptics.modeSwitch();

        // 100ms araliklarla sunucudan imlec etrafi goruntusunu iste
        this.requestFrame();
        this.streamInterval = setInterval(() => {
            if (this.isActive) this.requestFrame();
        }, 120);
    }

    stop() {
        this.isActive = false;
        clearInterval(this.streamInterval);
        if (this.container) this.container.classList.remove('active');
        if (this.toggleBtn) this.toggleBtn.classList.remove('active');
        window.haptics.click();
    }

    requestFrame() {
        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'loupe_req',
                width: 100,
                height: 100
            });
        }
    }

    // Sunucudan gelen ham RGBA cerceveyi ciz
    handleFrame(frameData) {
        if (!this.isActive || !this.ctx || !this.canvas || !frameData.data) return;

        try {
            const w = frameData.width || 100;
            const h = frameData.height || 100;
            const binary = atob(frameData.data);
            const expectedLen = w * h * 4;
            if (binary.length < expectedLen) return;

            const bytes = new Uint8ClampedArray(expectedLen);
            for (let i = 0; i < expectedLen; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            if (!this.offscreen || this.offscreen.width !== w || this.offscreen.height !== h) {
                this.offscreen = document.createElement('canvas');
                this.offscreen.width = w;
                this.offscreen.height = h;
                this.offCtx = this.offscreen.getContext('2d');
            }

            const imgData = new ImageData(bytes, w, h);
            this.offCtx.putImageData(imgData, 0, 0);

            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.imageSmoothingEnabled = false; // Piksel netligi
            this.ctx.drawImage(this.offscreen, 0, 0, this.canvas.width, this.canvas.height);

            // Hedef Noktasi / Arti Isareti (Crosshair Reticle) cizelim
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;

            this.ctx.strokeStyle = '#00e5ff';
            this.ctx.lineWidth = 1.5;

            this.ctx.beginPath();
            this.ctx.moveTo(cx - 15, cy);
            this.ctx.lineTo(cx + 15, cy);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy - 15);
            this.ctx.lineTo(cx, cy + 15);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            this.ctx.stroke();
        } catch (e) {
            console.log('Loupe frame cizim hatasi:', e);
        }
    }
}

window.magnifier = new MagnifierController();
