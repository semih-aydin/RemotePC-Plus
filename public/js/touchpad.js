// Precision Touchpad (Hassas Dokunmatik Yüzey ve Gelişmiş Sürükle-Bırak)

class TouchpadController {
    constructor() {
        this.pad = document.getElementById('touchpad-surface');
        this.scrollStrip = document.getElementById('scroll-strip-v');

        this.touchStartTime = 0;
        this.touchStartPositions = [];
        this.lastPositions = [];
        this.hasMoved = false;
        this.fingerCount = 0;

        // Tutup Sürükleme (Drag & Drop) Durumları
        this.lastTapEndTime = 0;
        this.isDoubleTapDragging = false;
        this.doubleTapHoldTimer = null;

        // 2 Parmak Pinch-Zoom & Scroll
        this.initialPinchDist = 0;
        this.lastPinchDist = 0;
        this.scrollVelY = 0;
        this.scrollVelX = 0;
        this.inertiaTimer = null;
        this.scrollAcc = 0;

        this.initEvents();
    }

    initEvents() {
        if (!this.pad) return;

        this.pad.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.pad.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.pad.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.pad.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // Dikey Kaydırma Şeridi (Dedicated Scroll Strip)
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
                    window.app.send({ type: 'scroll', dy: dy * 0.45, dx: 0 });
                    this.scrollAcc += Math.abs(dy);
                    if (this.scrollAcc > 16) {
                        window.haptics.scrollDetent();
                        this.scrollAcc = 0;
                    }
                }
            }, { passive: false });
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        clearInterval(this.inertiaTimer);

        this.fingerCount = e.touches.length;
        this.touchStartTime = Date.now();
        this.hasMoved = false;

        this.touchStartPositions = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
        this.lastPositions = [...this.touchStartPositions];

        // === ÇİFT DOKUNUP TUTARAK SÜRÜKLEME (Double-Tap & Hold to Drag) ===
        if (this.fingerCount === 1) {
            const timeSinceLastTap = this.touchStartTime - this.lastTapEndTime;

            if (timeSinceLastTap < 300) {
                // Çift dokunuldu! Hemen sürükleme modunu başlat
                this.isDoubleTapDragging = true;
                window.app.send({ type: 'click', button: 'left', state: 'down' });
                window.haptics.click();
                this.showDragIndicator(true);
            }
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

        if (!this.hasMoved) {
            const dist = Math.hypot(
                curPositions[0].x - this.touchStartPositions[0].x,
                curPositions[0].y - this.touchStartPositions[0].y
            );
            if (dist > 5) {
                this.hasMoved = true;
            }
        }

        // === 1 PARMAK: Fareyi Hareket Ettir (Normal veya Sürükleme) ===
        if (e.touches.length === 1 && this.lastPositions.length >= 1) {
            const rawDx = curPositions[0].x - this.lastPositions[0].x;
            const rawDy = curPositions[0].y - this.lastPositions[0].y;

            // Yumuşak hız ivmesi
            const speed = Math.hypot(rawDx, rawDy);
            let multiplier = 1.35;
            if (speed > 4) {
                multiplier = 1.35 + (speed - 4) * 0.08;
            }

            window.app.send({
                type: 'move',
                dx: rawDx * multiplier,
                dy: rawDy * multiplier,
                t: Date.now()
            });
        }

        // === 2 PARMAK: Kaydırma veya Pinch Zoom ===
        else if (e.touches.length === 2 && this.lastPositions.length >= 2) {
            const curPinchDist = Math.hypot(
                curPositions[0].x - curPositions[1].x,
                curPositions[0].y - curPositions[1].y
            );
            const pinchDelta = curPinchDist - this.lastPinchDist;

            if (Math.abs(pinchDelta) > 10) {
                // Zoom
                window.app.send({ type: 'zoom', delta: pinchDelta > 0 ? 1 : -1 });
                this.lastPinchDist = curPinchDist;
            } else {
                // 2 Parmak Kaydırma
                const dy0 = curPositions[0].y - this.lastPositions[0].y;
                const dy1 = curPositions[1].y - this.lastPositions[1].y;
                const avgDy = (dy0 + dy1) / 2;

                const dx0 = curPositions[0].x - this.lastPositions[0].x;
                const dx1 = curPositions[1].x - this.lastPositions[1].x;
                const avgDx = (dx0 + dx1) / 2;

                this.scrollVelY = avgDy;
                this.scrollVelX = avgDx;

                if (Math.abs(avgDy) > 0.5 || Math.abs(avgDx) > 0.5) {
                    window.app.send({ type: 'scroll', dy: avgDy * 0.4, dx: -avgDx * 0.4 });
                }
            }
        }

        // === 3 PARMAK: Ekranlar Arası Işınlanma (Flick) ===
        else if (e.touches.length === 3 && this.touchStartPositions.length >= 3) {
            const startX = (this.touchStartPositions[0].x + this.touchStartPositions[1].x + this.touchStartPositions[2].x) / 3;
            const currentX = (curPositions[0].x + curPositions[1].x + curPositions[2].x) / 3;
            const deltaX = currentX - startX;

            if (Math.abs(deltaX) > 70 && !this.jumpTriggered) {
                this.jumpTriggered = true;
                window.haptics.monitorJump();
                if (window.multiMonitor) {
                    window.multiMonitor.jumpRelative(deltaX > 0 ? 'next' : 'prev');
                }
            }
        }

        this.lastPositions = [...curPositions];
    }

    handleTouchEnd(e) {
        const duration = Date.now() - this.touchStartTime;

        // Çift dokunup sürükleme modu bittiyse sol tuşu bırak
        if (this.isDoubleTapDragging) {
            this.isDoubleTapDragging = false;
            window.app.send({ type: 'click', button: 'left', state: 'up' });
            this.showDragIndicator(false);
            window.haptics.click();
        }

        // Kısa dokunuşla tıklamalar (Tap to Click)
        if (!this.hasMoved && duration < 240) {
            if (this.fingerCount === 1) {
                // 1 Parmak: Sol Tık
                window.app.send({ type: 'click', button: 'left', state: 'click' });
                window.haptics.click();
                this.lastTapEndTime = Date.now();
            } else if (this.fingerCount === 2) {
                // 2 Parmak: Sağ Tık
                window.app.send({ type: 'click', button: 'right', state: 'click' });
                window.haptics.rightClick();
            } else if (this.fingerCount === 3) {
                // 3 Parmak: Orta Tık
                window.app.send({ type: 'click', button: 'middle', state: 'click' });
                window.haptics.middleClick();
            }
        } else {
            if (this.fingerCount === 1) {
                this.lastTapEndTime = Date.now();
            }
        }

        // Ataletli kaydırma başlat
        if (this.fingerCount === 2 && Math.abs(this.scrollVelY) > 2) {
            this.startInertia();
        }

        this.jumpTriggered = false;
        this.fingerCount = e.touches.length;
    }

    startInertia() {
        clearInterval(this.inertiaTimer);
        let vy = this.scrollVelY * 0.85;

        this.inertiaTimer = setInterval(() => {
            vy *= 0.91;
            if (Math.abs(vy) < 0.1) {
                clearInterval(this.inertiaTimer);
                return;
            }
            window.app.send({ type: 'scroll', dy: vy * 0.4, dx: 0 });
        }, 16);
    }

    showDragIndicator(active) {
        const ind = document.getElementById('drag-status-indicator');
        if (ind) {
            ind.style.display = active ? 'block' : 'none';
        }
    }
}

window.touchpad = new TouchpadController();
