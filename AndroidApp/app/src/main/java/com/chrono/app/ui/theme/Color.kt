package com.chrono.app.ui.theme

import androidx.compose.ui.graphics.Color

val ChronoBgFrom = Color(0xFF0b0716)
val ChronoBgTo = Color(0xFF140d28)
val ChronoNeon = Color(0xFF8b5cf6)
val ChronoMint = Color(0xFFc084fc)
val ChronoFuchsia = Color(0xFFd946ef)
val ChronoMuted = Color(0xFF7c728f)

val ChronoSurface = Color(0x1AFFFFFF)
val ChronoSurfaceLight = Color(0x22FFFFFF)
val ChronoSurfaceGlass = Color(0x0CFFFFFF)
val ChronoBorder = Color(0x14FFFFFF)
val ChronoBorderLight = Color(0x22FFFFFF)

val ChronoTextPrimary = Color(0xE6FFFFFF)
val ChronoTextSecondary = Color(0x99FFFFFF)
val ChronoTextMuted = Color(0x59FFFFFF)

val Violet200 = Color(0xFFc4b5fd)
val Violet400 = Color(0xFFa78bfa)
val Violet500 = Color(0xFF8b5cf6)
val Violet600 = Color(0xFF7c3aed)
val Fuchsia500 = Color(0xFFd946ef)

val Rose400 = Color(0xFFfb7185)
val Amber500 = Color(0xFFf59e0b)
val Yellow400 = Color(0xFFfacc15)
val Emerald400 = Color(0xFF34d399)
val Cyan400 = Color(0xFF22d3ee)
val Slate500 = Color(0xFF64748b)

data class ChronoThemeColors(
    val id: String,
    val label: String,
    val bgFrom: Color,
    val bgMid: Color,
    val bgTo: Color,
    val accent: Color,
    val accentAlt: Color,
    val swatchFrom: Color,
    val swatchTo: Color,
    val glow1: Color,
    val glow2: Color,
)

val CHRONO_THEMES = listOf(
    ChronoThemeColors("amethyst", "Аметист",
        Color(0xFF0b0716), Color(0xFF1a0f30), Color(0xFF140d28),
        Violet500, Fuchsia500, Violet500, Fuchsia500,
        Color(0xCC8b5cf6), Color(0xB3c084fc)),
    ChronoThemeColors("emerald", "Изумруд",
        Color(0xFF021a0e), Color(0xFF0a2e1a), Color(0xFF0d2818),
        Emerald400, Color(0xFF34d399), Color(0xFF10b981), Emerald400,
        Color(0xAA10b981), Color(0x99059669)),
    ChronoThemeColors("midnight", "Полночь",
        Color(0xFF050d1f), Color(0xFF0c1a3a), Color(0xFF0d1428),
        Cyan400, Color(0xFF6366f1), Color(0xFF1e3a8a), Color(0xFF0ea5e9),
        Color(0xAA0ea5e9), Color(0x994f46e5)),
    ChronoThemeColors("sunset", "Закат",
        Color(0xFF1a0808), Color(0xFF2a1008), Color(0xFF28140d),
        Rose400, Amber500, Rose400, Amber500,
        Color(0xAAfb7185), Color(0x99f59e0b)),
    ChronoThemeColors("crimson", "Багровый",
        Color(0xFF1a0505), Color(0xFF2e0a0a), Color(0xFF280d0d),
        Color(0xFFef4444), Color(0xFFf97316), Color(0xFFef4444), Color(0xFFf97316),
        Color(0xAAef4444), Color(0x99f97316)),
    ChronoThemeColors("ocean", "Океан",
        Color(0xFF051518), Color(0xFF0a2528), Color(0xFF0d2128),
        Cyan400, Color(0xFF14b8a6), Color(0xFF06b6d4), Color(0xFF14b8a6),
        Color(0xAA06b6d4), Color(0x9914b8a6)),
    ChronoThemeColors("rose", "Роза",
        Color(0xFF1a0510), Color(0xFF2e0a1a), Color(0xFF280d1d),
        Color(0xFFf472b6), Color(0xFFf43f5e), Color(0xFFec4899), Color(0xFFf43f5e),
        Color(0xAAec4899), Color(0x99f43f5e)),
    ChronoThemeColors("gold", "Золото",
        Color(0xFF1a1205), Color(0xFF2e2008), Color(0xFF28200d),
        Yellow400, Amber500, Amber500, Yellow400,
        Color(0xAAf59e0b), Color(0x99eab308)),
    ChronoThemeColors("graphite", "Графит",
        Color(0xFF0e1117), Color(0xFF1a1f2b), Color(0xFF151a24),
        Slate500, Color(0xFF94a3b8), Slate500, Color(0xFF94a3b8),
        Color(0x8864748b), Color(0x7794a3b8)),
    ChronoThemeColors("steel", "Серый",
        Color(0xFF111827), Color(0xFF1f2937), Color(0xFF171f2e),
        Color(0xFF6b7280), Color(0xFF9ca3af), Color(0xFF4b5563), Color(0xFF6b7280),
        Color(0x666b7280), Color(0x559ca3af)),
    ChronoThemeColors("light", "Светлая",
        Color(0xFFf4f1fb), Color(0xFFede6f7), Color(0xFFe6e0f5),
        Violet500, Violet400, Color(0xFFf4f1fb), Color(0xFFe6e0f5),
        Color(0xAAc4b5fd), Color(0x99ddd6fe)),
    ChronoThemeColors("aurora", "Аврора",
        Color(0xFF051818), Color(0xFF0a2a2a), Color(0xFF0d2828),
        Cyan400, Violet500, Color(0xFF06b6d4), Violet500,
        Color(0xAA06b6d4), Color(0x888b5cf6)),
    ChronoThemeColors("lavender", "Лаванда",
        Color(0xFF180a18), Color(0xFF2a102a), Color(0xFF281428),
        Color(0xFFc084fc), Color(0xFFe9d5ff), Color(0xFFa78baa), Color(0xFFf0abfc),
        Color(0xAAA78B9A), Color(0x88E9D5FF)),
    ChronoThemeColors("neon", "Неон",
        Color(0xFF180510), Color(0xFF2e0a18), Color(0xFF280d18),
        Rose400, Cyan400, Color(0xFFf43f5e), Cyan400,
        Color(0xAAf43f5e), Color(0x8806b6d4)),
    ChronoThemeColors("forest", "Лес",
        Color(0xFF05180a), Color(0xFF0a2e14), Color(0xFF0d2814),
        Emerald400, Color(0xFF65a30d), Color(0xFF064e3b), Color(0xFF65a30d),
        Color(0xAA22c55e), Color(0x8865a30d)),
    ChronoThemeColors("cherry", "Вишня",
        Color(0xFF1a050a), Color(0xFF2e0a14), Color(0xFF280d18),
        Rose400, Color(0xFFfb7185), Color(0xFF881337), Rose400,
        Color(0xAAe11d48), Color(0x88fb7185)),
    ChronoThemeColors("arctic", "Арктика",
        Color(0xFF081518), Color(0xFF0e2228), Color(0xFF142828),
        Cyan400, Color(0xFFbae6fd), Color(0xFF7dd3fc), Color(0xFF38bdf8),
        Color(0xAA38bdf8), Color(0x88bae6fd)),
    ChronoThemeColors("volcano", "Вулкан",
        Color(0xFF1a0805), Color(0xFF2e1008), Color(0xFF28140d),
        Color(0xFFf97316), Amber500, Color(0xFFc2410c), Color(0xFFf97316),
        Color(0xAAea580c), Color(0x88f97316)),
    ChronoThemeColors("sakura", "Сакура",
        Color(0xFF1a0810), Color(0xFF2e0e18), Color(0xFF281418),
        Color(0xFFf9a8d4), Color(0xFFfce7f3), Color(0xFFf472b6), Color(0xFFf9a8d4),
        Color(0xAAf9a8d4), Color(0x88fce7f3)),
    ChronoThemeColors("cyber", "Кибер",
        Color(0xFF050a1a), Color(0xFF0a142e), Color(0xFF0d1428),
        Violet500, Fuchsia500, Color(0xFF3b82f6), Fuchsia500,
        Color(0xAA3b82f6), Color(0x88d946ef)),
    ChronoThemeColors("autumn", "Осень",
        Color(0xFF180a05), Color(0xFF2e1408), Color(0xFF28140d),
        Amber500, Color(0xFFeab308), Color(0xFFb45309), Yellow400,
        Color(0xAAc2410c), Color(0x88eab308)),
)

val ACHIEVEMENT_THEMES = listOf(
    Triple(0, "amethyst", "Старт"),
    Triple(5, "emerald", "5 задач"),
    Triple(15, "ocean", "15 задач"),
    Triple(30, "sunset", "30 задач"),
    Triple(50, "gold", "50 задач"),
    Triple(100, "graphite", "100 задач"),
)
