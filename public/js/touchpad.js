// Universal Wireless Control Hub - Hassas Dokunmatik Yüzey ve Güvenli Sürükleme Motoru
// Yanlışlıkla sürükleme kilidini önleyen akıllı jest algılayıcı ve rAF optimizasyonu

class TouchpadController {
    constructor() {
        this.pad = document.getElementById('touchpad-surface');
        this.scrollStrip = document.getElementById('scroll-strip-v');

        this.touchStartTime = 0;
        this.touchStartPositions = [];
        this.lastPositions = [];
        this.hasMoved = false;
        this.fingerCount = 0;

        // Tutup Sürükleme (Drag & Drop) Güvenli Durumları
        this.lastTapEndTime = 0;
        this.lastTapPos = { x: 0, y: 0 };
        this.isPotentialDrag = false;
        this.isDragging = false;

        // 2 Parmak Pinch-Zoom & Scroll
        this.initialPinchDist = 0;
        this.lastPinchDist = 0;
        this.scrollVelY = 0;
        this.scrollVelX = 0;
        this.inertiaRafId = null;
        this.scrollAcc = 0;

        // Kullanıcı Ayarları (LocalStorage Destekli)
        this.sensitivity = 1.35;
        this.naturalScroll = true; // true: parmak yukarı = sayfa aşağı (doğal)
        this.enableDoubleTapDrag = true;

        // rAF Paket Toplayıcı
        this.pendingDx = 0;
        this.pendingDy = 0;
        this.rafScheduled = false;

        this.loadSettings();
        this.initEvents();
    }

    loadSettings() {
        try {
            const sens = localStorage.getItem('tp_sens');
            const nat = localStorage.getItem('tp_natural');
            const dtd = localStorage.getItem('tp_dtd');
            if (sens !== null) this.sensitivity = parseFloat(sens);
            if (nat !== null) this.naturalScroll = nat === 'true';
            if (dtd !== null) this.enableDoubleTapDrag = dtd === 'true';
        } catch (e) {}
    }

    updateSettings(opts = {}) {
        if (opts.sensitivity !== undefined) this.sensitivity = opts.sensitivity;
        if (opts.naturalScroll !== undefined) this.naturalScroll = opts.naturalScroll;
        if (opts.enableDoubleTapDrag !== undefined) this.enableDoubleTapDrag = opts.enableDoubleTapDrag;

        try {
            localStorage.setItem('tp_sens', this.sensitivity);
            localStorage.setItem('tp_natural', this.naturalScroll);
            localStorage.setItem('tp_dtd', this.enableDoubleTapDrag);
        } catch (e) {}
    }

    initEvents() {
        if (!this.pad) return;

        this.pad.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.pad.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.pad.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.pad.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // Güvenlik: Sayfa arka plana giderse sol tuşu daima serbest bırak
        window.addEventListener('blur', () => this.forceReleaseDrag());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.forceReleaseDrag();
        });

        // Dikey Hassas Kaydırma Şeridi (Dedicated Scroll Strip)
        if (this.scrollStrip) {
            let lastY = 0;
            this.scrollStrip.addEventListener('touchstart', (e) => {
                e.preventDefault();
                lastY = e.touches[0].clientY;
                this.scrollAcc = 0;
            }, { passive: false });

            this.scrollStrip.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const curY = e.touches[0].clientY;
                const dy = lastY - curY;
                lastY = curY;

                if (Math.abs(dy) > 0) {
                    window.app.send({ type: 'scroll', dy: dy * 0.5, dx: 0 });
                    this.scrollAcc += Math.abs(dy);
                    if (this.scrollAcc > 15) {
                        window.haptics.scrollDetent();
                        this.scrollAcc = 0;
                    }
                }
            }, { passive: false });
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        this.stopInertia();

        this.fingerCount = e.touches.length;
        this.touchStartTime = performance.now();
        this.hasMoved = false;

        this.touchStartPositions = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
        this.lastPositions = [...this.touchStartPositions];

        // === Akıllı Çift Dokunma Sürükleme Kontrolü ===
        if (this.fingerCount === 1 && this.enableDoubleTapDrag) {
            const timeSinceLastTap = this.touchStartTime - this.lastTapEndTime;
            const distFromLastTap = Math.hypot(
                this.touchStartPositions[0].x - this.lastTapPos.x,
                this.touchStartPositions[0].y - this.lastTapPos.y
            );

            // Sadece aynı noktaya (20px içi) ve çok hızlı (< 240ms) ikinci kez dokunulursa "potansiyel sürükleme" say
            if (timeSinceLastTap < 240 && distFromLastTap < 20) {
                this.isPotentialDrag = true;
            } else {
                this.isPotentialDrag = false;
            }
        } else {
            this.isPotentialDrag = false;
        }

        // 2 Parmak Başlangıcı (Pinch / Scroll)
        if (this.fingerCount === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            this.initialPinchDist = Math.hypot(dx, dy);
            this.lastPinchDist = this.initialPinchDist;
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const curPositions = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));

        const moveDist = Math.hypot(
            curPositions[0].x - this.touchStartPositions[0].x,
            curPositions[0].y - this.touchStartPositions[0].y
        );

        if (moveDist > 4) {
            this.hasMoved = true;
        }

        // Eğer potansiyel sürükleme modundaysa ve parmak bilinçli olarak hareket ettiyse sürüklemeyi başlat
        if (this.isPotentialDrag && !this.isDragging && moveDist > 8) {
            this.isDragging = true;
            window.app.send({ type: 'click', button: 'left', state: 'down' });
            this.showDragIndicator(true);
            window.haptics.click();
        }

        // === 1 PARMAK: Fare Hareketi (Normal veya Sürükleme) ===
        if (e.touches.length === 1 && this.lastPositions.length >= 1) {
            const rawDx = curPositions[0].x - this.lastPositions[0].x;
            const rawDy = curPositions[0].y - this.lastPositions[0].y;

            // Hassas İvmelenme Eğrisi (Kullanıcı Hassasiyeti ile Ölçekli)
            const speed = Math.hypot(rawDx, rawDy);
            let multiplier = this.sensitivity;
            if (speed > 3.0) {
                multiplier = this.sensitivity + Math.min(2.5, Math.pow((speed - 3.0) * 0.12, 1.15));
            }

            this.pendingDx += rawDx * multiplier;
            this.pendingDy += rawDy * multiplier;

            if (!this.rafScheduled) {
                this.rafScheduled = true;
                requestAnimationFrame(() => this.flushMovement());
            }
        }

        // === 2 PARMAK: Kaydırma veya Pinch Zoom ===
        else if (e.touches.length === 2 && this.lastPositions.length >= 2) {
            const curPinchDist = Math.hypot(
                curPositions[0].x - curPositions[1].x,
                curPositions[0].y - curPositions[1].y
            );
            const pinchDelta = curPinchDist - this.lastPinchDist;

            if (Math.abs(pinchDelta) > 8) {
                window.app.send({ type: 'zoom', delta: pinchDelta > 0 ? 1 : -1 });
                this.lastPinchDist = curPinchDist;
            } else {
                const dy0 = curPositions[0].y - this.lastPositions[0].y;
                const dy1 = curPositions[1].y - this.lastPositions[1].y;
                const avgDy = (dy0 + dy1) * 0.5;

                const dx0 = curPositions[0].x - this.lastPositions[0].x;
                const dx1 = curPositions[1].x - this.lastPositions[1].x;
                const avgDx = (dx0 + dx1) * 0.5;

                const scrollDir = this.naturalScroll ? 1 : -1;
                this.scrollVelY = avgDy * scrollDir;
                this.scrollVelX = avgDx * scrollDir;

                if (Math.abs(avgDy) > 0.3 || Math.abs(avgDx) > 0.3) {
                    window.app.send({ type: 'scroll', dy: avgDy * 0.45 * scrollDir, dx: -avgDx * 0.45 * scrollDir });
                }
            }
        }

        // === 3 PARMAK: Ekranlar Arası Işınlanma ===
        else if (e.touches.length === 3 && this.touchStartPositions.length >= 3) {
            const startX = (this.touchStartPositions[0].x + this.touchStartPositions[1].x + this.touchStartPositions[2].x) / 3;
            const currentX = (curPositions[0].x + curPositions[1].x + curPositions[2].x) / 3;
            const deltaX = currentX - startX;

            if (Math.abs(deltaX) > 60 && !this.jumpTriggered) {
                this.jumpTriggered = true;
                window.haptics.monitorJump();
                if (window.multiMonitor) {
                    window.multiMonitor.jumpRelative(deltaX > 0 ? 'next' : 'prev');
                }
            }
        }

        this.lastPositions = [...curPositions];
    }

    flushMovement() {
        this.rafScheduled = false;
        if (Math.abs(this.pendingDx) > 0.01 || Math.abs(this.pendingDy) > 0.01) {
            window.app.send({
                type: 'move',
                dx: this.pendingDx,
                dy: this.pendingDy,
                t: Date.now()
            });
            this.pendingDx = 0;
            this.pendingDy = 0;
        }
    }

    handleTouchEnd(e) {
        const duration = performance.now() - this.touchStartTime;

        if (this.rafScheduled) {
            this.flushMovement();
        }

        // Sürükleme modundaysa mutlaka bırak
        if (this.isDragging) {
            this.isDragging = false;
            this.isPotentialDrag = false;
            window.app.send({ type: 'click', button: 'left', state: 'up' });
            this.showDragIndicator(false);
            window.haptics.click();
        }

        // Kısa dokunuşla tıklamalar (Tap to Click)
        if (!this.hasMoved && duration < 200) {
            if (this.fingerCount === 1) {
                // Eğer potansiyel çift tıklamaysa çift tık yap
                if (this.isPotentialDrag) {
                    window.app.send({ type: 'click', button: 'left', state: 'double' });
                    window.haptics.click();
                    this.lastTapEndTime = 0;
                } else {
                    window.app.send({ type: 'click', button: 'left', state: 'click' });
                    window.haptics.click();
                    this.lastTapEndTime = performance.now();
                    if (this.touchStartPositions[0]) {
                        this.lastTapPos = { x: this.touchStartPositions[0].x, y: this.touchStartPositions[0].y };
                    }
                }
            } else if (this.fingerCount === 2) {
                window.app.send({ type: 'click', button: 'right', state: 'click' });
                window.haptics.rightClick();
            } else if (this.fingerCount === 3) {
                window.app.send({ type: 'click', button: 'middle', state: 'click' });
                window.haptics.middleClick();
            }
        } else {
            this.isPotentialDrag = false;
        }

        // 2 Parmak Ataletli Kaydırma
        if (this.fingerCount === 2 && Math.abs(this.scrollVelY) > 1.5) {
            this.startKineticInertia();
        }

        this.jumpTriggered = false;
        this.fingerCount = e.touches.length;
    }

    forceReleaseDrag() {
        if (this.isDragging) {
            this.isDragging = false;
            this.isPotentialDrag = false;
            window.app.send({ type: 'click', button: 'left', state: 'up' });
            this.showDragIndicator(false);
        }
    }

    startKineticInertia() {
        this.stopInertia();
        let vy = this.scrollVelY * 0.82;
        let vx = this.scrollVelX * 0.82;

        const step = () => {
            vy *= 0.92;
            vx *= 0.92;

            if (Math.abs(vy) < 0.1 && Math.abs(vx) < 0.1) {
                return;
            }

            window.app.send({ type: 'scroll', dy: vy * 0.45, dx: -vx * 0.45 });
            this.inertiaRafId = requestAnimationFrame(step);
        };

        this.inertiaRafId = requestAnimationFrame(step);
    }

    stopInertia() {
        if (this.inertiaRafId) {
            cancelAnimationFrame(this.inertiaRafId);
            this.inertiaRafId = null;
        }
    }

    showDragIndicator(active) {
        const ind = document.getElementById('drag-status-indicator');
        if (ind) {
            ind.style.display = active ? 'block' : 'none';
        }
    }
}

window.touchpad = new TouchpadController();
