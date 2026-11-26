package com.semih.remotepcplus

import android.content.Context
import android.content.SharedPreferences

class Prefs(context: Context) {
    private val sp: SharedPreferences =
        context.getSharedPreferences("remotepc_prefs", Context.MODE_PRIVATE)

    var host: String
        get() = sp.getString("host", "") ?: ""
        set(value) = sp.edit().putString("host", value).apply()

    var port: Int
        get() = sp.getInt("port", 5000)
        set(value) = sp.edit().putInt("port", value).apply()

    var pcName: String
        get() = sp.getString("pc_name", "") ?: ""
        set(value) = sp.edit().putString("pc_name", value).apply()

    var pin: String
        get() = sp.getString("pin", "") ?: ""
        set(value) = sp.edit().putString("pin", value).apply()

    var sensitivity: Float
        get() = sp.getFloat("sensitivity", 1.4f)
        set(value) = sp.edit().putFloat("sensitivity", value).apply()

    var naturalScroll: Boolean
        get() = sp.getBoolean("natural_scroll", true)
        set(value) = sp.edit().putBoolean("natural_scroll", value).apply()

    var doubleTapDrag: Boolean
        get() = sp.getBoolean("double_tap_drag", true)
        set(value) = sp.edit().putBoolean("double_tap_drag", value).apply()

    var hapticsEnabled: Boolean
        get() = sp.getBoolean("haptics_enabled", true)
        set(value) = sp.edit().putBoolean("haptics_enabled", value).apply()

    // "light" (apple.com default), "dark", "system"
    var themeMode: String
        get() = sp.getString("theme_mode", "light") ?: "light"
        set(value) = sp.edit().putString("theme_mode", value).apply()

    fun hasSavedPc(): Boolean = host.isNotBlank()

    fun savePc(name: String, ip: String, port: Int) {
        sp.edit()
            .putString("pc_name", name)
            .putString("host", ip)
            .putInt("port", port)
            .apply()
    }
}
