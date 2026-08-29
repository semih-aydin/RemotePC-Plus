// Precision Touchpad (Hassas Coklu Dokunmatik Izleme Alani)
// 1, 2 ve 3 parmak hareketleri, ataletli kaydirma, pinch zoom, screen-jump hareketleri

class TouchpadController {
    constructor() {
        this.pad = document.getElementById('touchpad-surface');
        this.scrollStrip = document.getElementById('scroll-strip-v');
        this.hScrollStrip = document.getElementById('scroll-strip-h');

        this.touches = new Map();
        this.touchStartTime = 0;
        this.touchStartPositions = [];
        this.lastPositions = [];
        this.hasMoved = false;
        this.fingerCount = 0;

        // Long press zamanlayicisi (Radial Menu icin)
        this.longPressTimer = null;
        this.isLongPressTriggered = false;

        // Cift tikla ve surukle (Drag Lock)
        this.lastTapTime = 0;
        this.isDragging = false;

        // 2 Parmak Pinch-Zoom takibi
        this.initialPinchDistance = 0;
        this.lastPinchDistance = 0;

        // Ataletli kaydirma (Inertial Scrolling)
        this.scrollVelocityY = 0;
        this.scrollVelocityX = 0;
        this.inertiaInterval = null;
        this.lastScrollTickY = 0;

        this.initEvents();
    }

    initEvents() {
        if (!this.pad) return;

        // Dokunmatik olaylar
        this.pad.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.pad.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.pad.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.pad.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // Dikey Kaydirma Cubugu (Dedicated Scroll Strip)
        if (this.scrollStrip) {
            let lastY = 0;
            let accY = 0;

            this.scrollStrip.addEventListener('touchstart', (e) => {
                e.preventDefault();
                lastY = e.touches[0].clientY;
                accY = 0;
            }, { passive: false });

            this.scrollStrip.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const curY = e.touches[0].clientY;
                const dy = lastY - curY;
                lastY = curY;

                if (Math.abs(dy) > 0) {
                    window.app.send({ type: 'scroll', dy: dy * 0.4, dx: 0 });
                    accY += Math.abs(dy);
                    if (accY > 18) {
                        window.haptics.scrollDetent();
                        accY = 0;
                    }
                }
            }, { passive: false });
        }

        // Yatay Kaydirma Cubugu
        if (this.hScrollStrip) {
            let lastX = 0;
            let accX = 0;

            this.hScrollStrip.addEventListener('touchstart', (e) => {
                e.preventDefault();
                lastX = e.touches[0].clientX;
                accX = 0;
            }, { passive: false });

            this.hScrollStrip.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const curX = e.touches[0].clientX;
                const dx = curX - lastX;
                lastX = curX;

                if (Math.abs(dx) > 0) {
                    window.app.send({ type: 'scroll', dy: 0, dx: dx * 0.4 });
                    accX += Math.abs(dx);
                    if (accX > 18) {
                        window.haptics.scrollDetent();
                        accX = 0;
                    }
                }
            }, { passive: false });
        }
    }

    handleTouchStart(e) {
        e.preventDefault();
        clearInterval(this.inertiaInterval);

        this.fingerCount = e.touches.length;
        this.touchStartTime = Date.now();
        this.hasMoved = false;
        this.isLongPressTriggered = false;

        this.touchStartPositions = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
        this.lastPositions = [...this.touchStartPositions];

        // 1 parmak dokunusta: Cift tikla-surukle veya Long-press kontrolu
        if (this.fingerCount === 1) {
            const timeSinceLastTap = this.touchStartTime - this.lastTapTime;
            if (timeSinceLastTap < 260) {
                // Cift tiklandi ve basili tutuldu -> Sol tusu basili tut (Drag Mode)
                this.isDragging = true;
                window.app.send({ type: 'click', button: 'left', state: 'down' });
                window.haptics.click();
            }

            // 8-Way Radial Menu icin Long Press Zamanlayicisi
            this.longPressTimer = setTimeout(() => {
                if (!this.hasMoved && !this.isDragging && this.fingerCount === 1) {
                    this.isLongPressTriggered = true;
                    if (window.radialMenu) {
                        window.radialMenu.open(this.touchStartPositions[0].x, this.touchStartPositions[0].y);
                    }
                }
            }, 450);
        } else {
            clearTimeout(this.longPressTimer);
        }

        // 2 parmak baslangici (Pinch veya Scroll)
        if (this.fingerCount === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            this.initialPinchDistance = Math.hypot(dx, dy);
            this.lastPinchDistance = this.initialPinchDistance;
            this.lastScrollTickY = 0;
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        const curPositions = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));

        // Eger Radial Menu aciksa tekerlegi yonlendir
        if (this.isLongPressTriggered && window.radialMenu && window.radialMenu.isOpen) {
            window.radialMenu.handleTouchMove(curPositions[0].x, curPositions[0].y);
            return;
        }

        // Hareketi tespit et
        if (!this.hasMoved) {
            const dist = Math.hypot(
                curPositions[0].x - this.touchStartPositions[0].x,
                curPositions[0].y - this.touchStartPositions[0].y
            );
            if (dist > 8) {
                this.hasMoved = true;
                clearTimeout(this.longPressTimer);
            }
        }

        // === 1 PARMAK: Fare Imlecini Hareket Ettir ===
        if (e.touches.length === 1 && this.lastPositions.length >= 1) {
            const rawDx = curPositions[0].x - this.lastPositions[0].x;
            const rawDy = curPositions[0].y - this.lastPositions[0].y;

            // Hiz temelli ivme hesabi
            const speed = Math.hypot(rawDx, rawDy);
            let multiplier = 1.3;
            if (speed > 4) {
                multiplier = 1.3 + (speed - 4) * 0.08;
            }

            window.app.send({
                type: 'move',
                dx: rawDx * multiplier,
                dy: rawDy * multiplier,
                t: Date.now()
            });
        }

        // === 2 PARMAK: Iki Parmakla Kaydirma veya Pinch-to-Zoom ===
        else if (e.touches.length === 2 && this.lastPositions.length >= 2) {
            const curPinchDist = Math.hypot(
                curPositions[0].x - curPositions[1].x,
                curPositions[0].y - curPositions[1].y
            );
            const pinchDelta = curPinchDist - this.lastPinchDistance;

            // Pinch-to-Zoom (Parmaklari acma / kisma)
            if (Math.abs(pinchDelta) > 12) {
                window.app.send({ type: 'zoom', delta: pinchDelta > 0 ? 1 : -1 });
                this.lastPinchDistance = curPinchDist;
            } else {
                // Iki parmakla kaydirma (2-Finger Kinetic Scrolling)
                const dy0 = curPositions[0].y - this.lastPositions[0].y;
                const dy1 = curPositions[1].y - this.lastPositions[1].y;
                const avgDy = (dy0 + dy1) / 2;

                const dx0 = curPositions[0].x - this.lastPositions[0].x;
                const dx1 = curPositions[1].x - this.lastPositions[1].y;
                const avgDx = (dx0 + dx1) / 2;

                this.scrollVelocityY = avgDy;
                this.scrollVelocityX = avgDx;

                if (Math.abs(avgDy) > 0.5 || Math.abs(avgDx) > 0.5) {
                    window.app.send({ type: 'scroll', dy: avgDy * 0.35, dx: -avgDx * 0.35 });
                    this.lastScrollTickY += Math.abs(avgDy);
                    if (this.lastScrollTickY > 25) {
                        window.haptics.scrollDetent();
                        this.lastScrollTickY = 0;
                    }
                }
            }
        }

        // === 3 PARMAK: Ekranlar Arasi Hizli Isinlanma (Screen Jump Flick) ===
        else if (e.touches.length === 3 && this.touchStartPositions.length >= 3) {
            const startX = (this.touchStartPositions[0].x + this.touchStartPositions[1].x + this.touchStartPositions[2].x) / 3;
            const currentX = (curPositions[0].x + curPositions[1].x + curPositions[2].x) / 3;
            const deltaX = currentX - startX;

            if (Math.abs(deltaX) > 80 && !this.screenJumpTriggered) {
                this.screenJumpTriggered = true;
                window.haptics.monitorJump();
                const direction = deltaX > 0 ? 'next' : 'prev';
                if (window.multiMonitor) {
                    window.multiMonitor.jumpRelative(direction);
                }
            }
        }

        this.lastPositions = [...curPositions];
    }

    handleTouchEnd(e) {
        clearTimeout(this.longPressTimer);
        const duration = Date.now() - this.touchStartTime;

        // Radial Menu aciksa kapat ve secilen makroyu calistir
        if (this.isLongPressTriggered && window.radialMenu && window.radialMenu.isOpen) {
            window.radialMenu.closeAndExecute();
            this.isLongPressTriggered = false;
            return;
        }

        // Surukleme modu aciksa sol tusu birak
        if (this.isDragging) {
            this.isDragging = false;
            window.app.send({ type: 'click', button: 'left', state: 'up' });
        }

        // === KISA DOKUNUSLAR (Tap to Click) ===
        if (!this.hasMoved && duration < 240) {
            if (this.fingerCount === 1) {
                // 1 Parmak Dokunus: Sol Tik
                window.app.send({ type: 'click', button: 'left', state: 'click' });
                window.haptics.click();
                this.lastTapTime = Date.now();
            } else if (this.fingerCount === 2) {
                // 2 Parmak Dokunus: Sag Tik
                window.app.send({ type: 'click', button: 'right', state: 'click' });
                window.haptics.rightClick();
            } else if (this.fingerCount === 3) {
                // 3 Parmak Dokunus: Orta Tik
                window.app.send({ type: 'click', button: 'middle', state: 'click' });
                window.haptics.middleClick();
            }
        }

        // 2 parmak birakildiginda ataletli kaydirma (Inertial scroll physics)
        if (this.fingerCount === 2 && (Math.abs(this.scrollVelocityY) > 2 || Math.abs(this.scrollVelocityX) > 2)) {
            this.startInertiaScroll();
        }

        this.screenJumpTriggered = false;
        this.fingerCount = e.touches.length;
        if (e.touches.length === 0) {
            this.touches.clear();
        }
    }

    // Ataletli / Momentum Kaydirma
    startInertiaScroll() {
        clearInterval(this.inertiaInterval);
        let velY = this.scrollVelocityY * 0.85;
        let velX = this.scrollVelocityX * 0.85;

        this.inertiaInterval = setInterval(() => {
            velY *= 0.91; // Surrtunme katsayisi
            velX *= 0.91;

            if (Math.abs(velY) < 0.1 && Math.abs(velX) < 0.1) {
                clearInterval(this.inertiaInterval);
                return;
            }

            window.app.send({ type: 'scroll', dy: velY * 0.35, dx: -velX * 0.35 });
        }, 16);
    }
}

window.touchpad = new TouchpadController();
