package com.semih.remotepcplus

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

class HapticsHelper(context: Context, private val prefs: Prefs) {
    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        vm?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    private fun pulse(ms: Long, amplitude: Int = 90) {
        if (!prefs.hapticsEnabled) return
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot(ms, amplitude))
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(ms)
            }
        } catch (_: Exception) {
        }
    }

    fun click() = pulse(12, 85)
    fun rightClick() = pulse(22, 110)
    fun middleClick() = pulse(18, 100)
    fun boundaryHit() = pulse(35, 160)
    fun monitorJump() = pulse(28, 130)
}
