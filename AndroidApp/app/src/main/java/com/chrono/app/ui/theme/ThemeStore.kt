package com.chrono.app.ui.theme

import android.content.Context
import androidx.compose.runtime.mutableStateOf

object ThemeStore {
    private val _currentThemeId = mutableStateOf("amethyst")
    val currentThemeId: String get() = _currentThemeId.value

    fun init(context: Context) {
        val prefs = context.getSharedPreferences("chrono_ui", Context.MODE_PRIVATE)
        _currentThemeId.value = prefs.getString("theme", "amethyst") ?: "amethyst"
    }

    fun setTheme(context: Context, themeId: String) {
        _currentThemeId.value = themeId
        context.getSharedPreferences("chrono_ui", Context.MODE_PRIVATE)
            .edit().putString("theme", themeId).apply()
    }

    fun currentTheme(): ChronoThemeColors {
        return CHRONO_THEMES.find { it.id == _currentThemeId.value } ?: CHRONO_THEMES[0]
    }
}
