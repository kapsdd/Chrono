package com.chrono.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = ChronoNeon,
    onPrimary = Color.White,
    primaryContainer = Violet600,
    secondary = ChronoFuchsia,
    surface = ChronoSurface,
    surfaceVariant = ChronoSurfaceLight,
    onBackground = ChronoTextPrimary,
    onSurface = ChronoTextPrimary,
    onSurfaceVariant = ChronoTextSecondary,
    outline = Color(0x33FFFFFF),
    error = Rose400,
)

@Composable
fun ChronoTheme(content: @Composable () -> Unit) {
    val theme = ThemeStore.currentTheme()
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = theme.bgFrom.toArgb()
            window.navigationBarColor = theme.bgFrom.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = ChronoTypography,
        content = content
    )
}

@Composable
fun chronoGradient(): Brush {
    val theme = ThemeStore.currentTheme()
    return Brush.verticalGradient(colors = listOf(theme.bgFrom, theme.bgMid, theme.bgTo))
}

@Composable
fun Modifier.chronoBackground(): Modifier {
    val theme = ThemeStore.currentTheme()
    return this
        .background(chronoGradient())
        .background(chronoGlow1(theme))
        .background(chronoGlow2(theme))
}

@Composable
fun chronoSurfaceBrush(): Brush {
    val theme = ThemeStore.currentTheme()
    return Brush.verticalGradient(
        colors = listOf(
            theme.bgFrom.copy(alpha = 0.95f),
            theme.bgMid.copy(alpha = 0.97f),
            theme.bgTo.copy(alpha = 0.98f),
        )
    )
}

fun chronoGlow1(theme: ChronoThemeColors): Brush {
    return Brush.radialGradient(
        colors = listOf(theme.glow1, Color.Transparent),
        center = Offset(0f, 0f),
        radius = 800f
    )
}

fun chronoGlow2(theme: ChronoThemeColors): Brush {
    return Brush.radialGradient(
        colors = listOf(theme.glow2, Color.Transparent),
        center = Offset(1f, 1f),
        radius = 700f
    )
}

fun Modifier.glass(
    cornerRadius: Int = 20,
    alpha: Float = 0.08f,
    borderAlpha: Float = 0.14f,
): Modifier = this
    .clip(RoundedCornerShape(cornerRadius.dp))
    .background(Color.White.copy(alpha = alpha))
    .border(
        width = 1.dp,
        color = Color.White.copy(alpha = borderAlpha),
        shape = RoundedCornerShape(cornerRadius.dp)
    )

fun Modifier.glassCard(): Modifier = this.glass(16, 0.06f, 0.10f)

fun Modifier.glassPanel(): Modifier = this.glass(24, 0.05f, 0.12f)
