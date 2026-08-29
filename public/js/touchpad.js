// Universal Wireless Control Hub - Ultra Optimize Hassas Dokunmatik Motor (rAF Batching & Kinetic Physics)

class TouchpadController {
    constructor() {
        this.pad = document.getElementById('touchpad-surface');
        this.scrollStrip = document.getElementById('scroll-strip-v');

        this.touchStartTime = 0;
        this.touchStartPositions = [];
        this.lastPositions = [];
        this.hasMoved = false;
        this.fingerCount = 0;

        // Tutup Sürükleme (Drag & Drop)
        this.lastTapEndTime = 0;
        this.isDoubleTapDragging = false;

        // 2 Parmak Pinch-Zoom & Scroll
        this.initialPinchDist = 0;
        this.lastPinchDist = 0;
        this.scrollVelY = 0;
        this.scrollVelX = 0;
        this.inertiaRafId = null;
        this.scrollAcc = 0;

        // rAF (requestAnimationFrame) Paket Toplayıcı (Batching: 60Hz/120Hz Ekran Senkronizasyonu)
        this.pendingDx = 0;
        this.pendingDy = 0;
        this.rafScheduled = false;

        this.initEvents();
    }

    initEvents() {
        if (!this.pad) return;

        this.pad.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.pad.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.pad.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.pad.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

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

        // === ÇİFT DOKUNUP TUTARAK SÜRÜKLEME (Double-Tap & Hold to Drag) ===
        if (this.fingerCount === 1) {
            const timeSinceLastTap = this.touchStartTime - this.lastTapEndTime;

            if (timeSinceLastTap < 280) {
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
            if (dist > 4) {
                this.hasMoved = true;
            }
        }

        // === 1 PARMAK: Fareyi Hareket Ettir (rAF Toplayıcı ile Sıfır Ağ Şişmesi) ===
        if (e.touches.length === 1 && this.lastPositions.length >= 1) {
            const rawDx = curPositions[0].x - this.lastPositions[0].x;
            const rawDy = curPositions[0].y - this.lastPositions[0].y;

            // Hassas İvmelenme Eğrisi (Power Curve)
            const speed = Math.hypot(rawDx, rawDy);
            let multiplier = 1.35;
            if (speed > 3.0) {
                multiplier = 1.35 + Math.min(2.5, Math.pow((speed - 3.0) * 0.12, 1.15));
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
                // Zoom
                window.app.send({ type: 'zoom', delta: pinchDelta > 0 ? 1 : -1 });
                this.lastPinchDist = curPinchDist;
            } else {
                // 2 Parmak Kaydırma (Hem Dikey Hem Yatay)
                const dy0 = curPositions[0].y - this.lastPositions[0].y;
                const dy1 = curPositions[1].y - this.lastPositions[1].y;
                const avgDy = (dy0 + dy1) * 0.5;

                const dx0 = curPositions[0].x - this.lastPositions[0].x;
                const dx1 = curPositions[1].x - this.lastPositions[1].x;
                const avgDx = (dx0 + dx1) * 0.5;

                this.scrollVelY = avgDy;
                this.scrollVelX = avgDx;

                if (Math.abs(avgDy) > 0.3 || Math.abs(avgDx) > 0.3) {
                    window.app.send({ type: 'scroll', dy: avgDy * 0.45, dx: -avgDx * 0.45 });
                }
            }
        }

        // === 3 PARMAK: Ekranlar Arası Işınlanma (Flick Jump) ===
        else if (e.touches.length === 3 && this.touchStartPositions.length >= 3) {
            const startX = (this.touchStartPositions[0].x + this.touchStartPositions[1].x + this.touchStartPositions[2].x) / 3;
            const currentX = (curPositions[0].x + curPositions[0].x + curPositions[2].x) / 3;
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

    // Toplanan mikro hareketleri tek bir ağ paketinde gönder
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

        // Kalan hareket varsa hemen bas
        if (this.rafScheduled) {
            this.flushMovement();
        }

        // Çift dokunup sürükleme modu bittiyse sol tuşu bırak
        if (this.isDoubleTapDragging) {
            this.isDoubleTapDragging = false;
            window.app.send({ type: 'click', button: 'left', state: 'up' });
            this.showDragIndicator(false);
            window.haptics.click();
        }

        // Kısa dokunuşla tıklamalar (Tap to Click: 200ms altı dokunuş)
        if (!this.hasMoved && duration < 220) {
            if (this.fingerCount === 1) {
                // 1 Parmak: Sol Tık
                window.app.send({ type: 'click', button: 'left', state: 'click' });
                window.haptics.click();
                this.lastTapEndTime = performance.now();
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
                this.lastTapEndTime = performance.now();
            }
        }

        // 2 Parmak Ataletli Kaydırma (Kinetic Inertial Physics)
        if (this.fingerCount === 2 && Math.abs(this.scrollVelY) > 1.5) {
            this.startKineticInertia();
        }

        this.jumpTriggered = false;
        this.fingerCount = e.touches.length;
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
