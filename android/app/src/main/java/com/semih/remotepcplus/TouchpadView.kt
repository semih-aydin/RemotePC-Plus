package com.semih.remotepcplus

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.min
import kotlin.math.pow

class TouchpadView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    interface Callback {
        fun onMove(dx: Float, dy: Float)
        fun onClick(button: String, state: String)
        fun onScroll(dy: Float, dx: Float)
        fun onZoom(delta: Int)
        fun onMonitorSwipe(direction: String)
        fun onDragStateChanged(isDragging: Boolean)
    }

    var callback: Callback? = null
    var sensitivity: Float = 1.4f
    var naturalScroll: Boolean = true
    var doubleTapDragEnabled: Boolean = true

    private val density = resources.displayMetrics.density

    private var touchStartTime = 0L
    private var maxFingersInGesture = 0
    private var startX0 = 0f
    private var startY0 = 0f
    private var lastX0 = 0f
    private var lastY0 = 0f
    private var lastX1 = 0f
    private var lastY1 = 0f
    private var lastPinchDist = 0f
    private var threeFingerStartX = 0f
    private var monitorSwipeTriggered = false
    private var hasMoved = false

    private var lastTapEndTime = 0L
    private var lastTapX = 0f
    private var lastTapY = 0f
    private var isPotentialDrag = false
    private var isDragging = false

    private var pendingDx = 0f
    private var pendingDy = 0f
    private var flushScheduled = false

    // Tactile contact halo coordinates
    private var touchActive = false
    private var contactX = 0f
    private var contactY = 0f

    // Apple Magic Trackpad matte-glass surface paints
    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF1C1C1E.toInt()
        style = Paint.Style.FILL
    }
    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF2C2C2E.toInt()
        style = Paint.Style.STROKE
        strokeWidth = 1f * density
    }
    private val dragBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF0A84FF.toInt()
        style = Paint.Style.STROKE
        strokeWidth = 2f * density
    }
    private val haloFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x220A84FF
        style = Paint.Style.FILL
    }
    private val haloRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x660A84FF
        style = Paint.Style.STROKE
        strokeWidth = 1f * density
    }
    private val hintTitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF8E8E93.toInt()
        textSize = 14f * density
        textAlign = Paint.Align.CENTER
    }
    private val hintSubPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF636366.toInt()
        textSize = 11.5f * density
        textAlign = Paint.Align.CENTER
    }
    private val rectF = RectF()
    private val cornerRadius = 24f * density

    private val flushRunnable = Runnable {
        flushScheduled = false
        if (abs(pendingDx) > 0.01f || abs(pendingDy) > 0.01f) {
            callback?.onMove(pendingDx, pendingDy)
            pendingDx = 0f
            pendingDy = 0f
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val pad = 2f * density
        rectF.set(pad, pad, width - pad, height - pad)
        canvas.drawRoundRect(rectF, cornerRadius, cornerRadius, bgPaint)
        canvas.drawRoundRect(
            rectF,
            cornerRadius,
            cornerRadius,
            if (isDragging) dragBorderPaint else borderPaint
        )

        // Clean Magic Trackpad contact halo while touching
        if (touchActive) {
            canvas.drawCircle(contactX, contactY, 28f * density, haloFillPaint)
            canvas.drawCircle(contactX, contactY, 28f * density, haloRingPaint)
        }

        val cx = width / 2f
        val cy = height / 2f
        canvas.drawText(
            if (isDragging) "Sürükleniyor" else "Trackpad",
            cx,
            cy - 6f * density,
            hintTitlePaint
        )
        canvas.drawText(
            "1 Parmak: Tık  •  2 Parmak: Sağ Tık / Kaydır  •  3 Parmak: Ekran",
            cx,
            cy + 14f * density,
            hintSubPaint
        )
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val count = event.pointerCount
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touchStartTime = SystemClock.uptimeMillis()
                maxFingersInGesture = 1
                hasMoved = false
                monitorSwipeTriggered = false

                startX0 = event.getX(0)
                startY0 = event.getY(0)
                lastX0 = startX0
                lastY0 = startY0
                touchActive = true
                contactX = startX0
                contactY = startY0
                invalidate()

                if (doubleTapDragEnabled) {
                    val dt = touchStartTime - lastTapEndTime
                    val distDp = hypot(startX0 - lastTapX, startY0 - lastTapY) / density
                    isPotentialDrag = (dt < 260L && distDp < 24f)
                } else {
                    isPotentialDrag = false
                }
                return true
            }

            MotionEvent.ACTION_POINTER_DOWN -> {
                if (count > maxFingersInGesture) maxFingersInGesture = count
                isPotentialDrag = false
                if (count >= 2) {
                    lastX0 = event.getX(0)
                    lastY0 = event.getY(0)
                    lastX1 = event.getX(1)
                    lastY1 = event.getY(1)
                    lastPinchDist = hypot(lastX0 - lastX1, lastY0 - lastY1)
                }
                if (count >= 3) {
                    threeFingerStartX = (event.getX(0) + event.getX(1) + event.getX(2)) / 3f
                }
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                contactX = event.getX(0)
                contactY = event.getY(0)
                invalidate()
                val moveDistDp = hypot(event.getX(0) - startX0, event.getY(0) - startY0) / density
                if (moveDistDp > 4f) hasMoved = true

                if (isPotentialDrag && !isDragging && count == 1 && moveDistDp > 8f) {
                    isDragging = true
                    callback?.onClick("left", "down")
                    callback?.onDragStateChanged(true)
                    invalidate()
                }

                when (count) {
                    1 -> {
                        if (maxFingersInGesture == 1) {
                            val rawDx = (event.getX(0) - lastX0) / density
                            val rawDy = (event.getY(0) - lastY0) / density
                            val speed = hypot(rawDx, rawDy)
                            var mult = sensitivity
                            if (speed > 3.0f) {
                                mult += min(2.5f, ((speed - 3.0f) * 0.12f).toDouble().pow(1.15).toFloat())
                            }
                            pendingDx += rawDx * mult
                            pendingDy += rawDy * mult
                            if (!flushScheduled) {
                                flushScheduled = true
                                postOnAnimation(flushRunnable)
                            }
                        }
                        lastX0 = event.getX(0)
                        lastY0 = event.getY(0)
                    }

                    2 -> {
                        val curX0 = event.getX(0)
                        val curY0 = event.getY(0)
                        val curX1 = event.getX(1)
                        val curY1 = event.getY(1)

                        val curPinch = hypot(curX0 - curX1, curY0 - curY1)
                        val pinchDeltaDp = (curPinch - lastPinchDist) / density

                        if (abs(pinchDeltaDp) > 12f) {
                            callback?.onZoom(if (pinchDeltaDp > 0) 1 else -1)
                            lastPinchDist = curPinch
                        } else {
                            val avgDy = (((curY0 - lastY0) + (curY1 - lastY1)) * 0.5f) / density
                            val avgDx = (((curX0 - lastX0) + (curX1 - lastX1)) * 0.5f) / density
                            val dir = if (naturalScroll) 1f else -1f
                            if (abs(avgDy) > 0.35f || abs(avgDx) > 0.35f) {
                                callback?.onScroll(avgDy * 0.45f * dir, -avgDx * 0.45f * dir)
                            }
                        }

                        lastX0 = curX0
                        lastY0 = curY0
                        lastX1 = curX1
                        lastY1 = curY1
                    }

                    3 -> {
                        val avgX = (event.getX(0) + event.getX(1) + event.getX(2)) / 3f
                        val deltaDp = (avgX - threeFingerStartX) / density
                        if (abs(deltaDp) > 55f && !monitorSwipeTriggered) {
                            monitorSwipeTriggered = true
                            callback?.onMonitorSwipe(if (deltaDp > 0) "next" else "prev")
                        }
                    }
                }
                return true
            }

            MotionEvent.ACTION_POINTER_UP -> {
                if (count == 2) {
                    val remainingIdx = if (event.actionIndex == 0) 1 else 0
                    lastX0 = event.getX(remainingIdx)
                    lastY0 = event.getY(remainingIdx)
                }
                return true
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                touchActive = false
                invalidate()
                if (flushScheduled) {
                    removeCallbacks(flushRunnable)
                    flushRunnable.run()
                }

                if (isDragging) {
                    isDragging = false
                    isPotentialDrag = false
                    callback?.onClick("left", "up")
                    callback?.onDragStateChanged(false)
                    invalidate()
                    return true
                }

                val duration = SystemClock.uptimeMillis() - touchStartTime
                if (event.actionMasked == MotionEvent.ACTION_UP && !hasMoved && duration < 220L) {
                    when (maxFingersInGesture) {
                        1 -> {
                            if (isPotentialDrag) {
                                callback?.onClick("left", "double")
                                lastTapEndTime = 0L
                            } else {
                                callback?.onClick("left", "click")
                                lastTapEndTime = SystemClock.uptimeMillis()
                                lastTapX = startX0
                                lastTapY = startY0
                            }
                        }

                        2 -> callback?.onClick("right", "click")
                        3 -> callback?.onClick("middle", "click")
                    }
                } else {
                    isPotentialDrag = false
                }
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    fun forceReleaseDrag() {
        if (isDragging) {
            isDragging = false
            isPotentialDrag = false
            callback?.onClick("left", "up")
            callback?.onDragStateChanged(false)
            invalidate()
        }
    }
}
