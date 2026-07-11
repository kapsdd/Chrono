package com.chrono.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.chrono.app.ui.components.GlassCard
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(vm: MainViewModel, onBack: () -> Unit) {
    val session by vm.session.collectAsState()
    val completedCount = vm.getCompletedCount()

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Настройки", color = ChronoTextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад", tint = ChronoTextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .chronoBackground()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                GlassCard {
                    Text("Аккаунт", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                    Spacer(Modifier.height(12.dp))
                    session?.let { s ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(Brush.linearGradient(listOf(Violet500, Fuchsia500))),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    s.username.firstOrNull()?.uppercase() ?: "?",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Color.White
                                )
                            }
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text(s.username, style = MaterialTheme.typography.bodyLarge, color = ChronoTextPrimary)
                                Text(
                                    if (s.provider == "google") "Google" else "Гостевая сессия",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ChronoTextMuted
                                )
                            }
                        }
                    } ?: Text("Не выполнен вход", color = ChronoTextMuted)
                }
            }

            // Theme selector
            item {
                GlassCard {
                    Text("Тема оформления", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "20 тем как в веб-версии",
                        style = MaterialTheme.typography.bodySmall,
                        color = ChronoTextMuted
                    )
                    Spacer(Modifier.height(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        CHRONO_THEMES.chunked(2).forEach { row ->
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                row.forEach { theme ->
                                    ThemeCard(
                                        theme = theme,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                if (row.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            item {
                GlassCard {
                    Text("Достижения", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                    Spacer(Modifier.height(8.dp))
                    Text("Выполнено задач: $completedCount", style = MaterialTheme.typography.bodyMedium, color = ChronoTextSecondary)
                    Spacer(Modifier.height(8.dp))
                    val milestones = listOf(0, 5, 15, 30, 50, 100)
                    val labels = listOf("Новичок", "Стажёр", "Опытный", "Мастер", "Эксперт", "Легенда")
                    milestones.forEachIndexed { i, m ->
                        val unlocked = completedCount >= m
                        Row(modifier = Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(if (unlocked) "✓" else "○", color = if (unlocked) Violet400 else ChronoTextMuted, modifier = Modifier.width(20.dp))
                            Text("${labels[i]} ($m)", style = MaterialTheme.typography.bodySmall, color = if (unlocked) ChronoTextPrimary else ChronoTextMuted)
                        }
                    }
                }
            }

            item {
                GlassCard {
                    Text("О приложении", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                    Spacer(Modifier.height(8.dp))
                    Text("CHRONO v1.0.0", style = MaterialTheme.typography.bodyMedium, color = ChronoTextSecondary)
                    Text("Премиум менеджер задач", style = MaterialTheme.typography.bodySmall, color = ChronoTextMuted)
                }
            }

            item {
                OutlinedButton(
                    onClick = { vm.signOut(); onBack() },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Rose400)
                ) {
                    Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Выйти из аккаунта")
                }
            }
        }
    }
}

@Composable
private fun ThemeCard(theme: ChronoThemeColors, modifier: Modifier = Modifier) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val isActive = ThemeStore.currentThemeId == theme.id
    Card(
        modifier = modifier
            .height(56.dp)
            .clickable { ThemeStore.setTheme(context, theme.id) },
        colors = CardDefaults.cardColors(
            containerColor = if (isActive) Violet500.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.06f)
        ),
        shape = RoundedCornerShape(12.dp),
        border = if (isActive) androidx.compose.foundation.BorderStroke(1.dp, Violet400.copy(alpha = 0.5f)) else null
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Brush.linearGradient(listOf(theme.swatchFrom, theme.swatchTo)))
            )
            Spacer(Modifier.width(8.dp))
            Text(
                theme.label,
                style = MaterialTheme.typography.labelSmall,
                color = if (isActive) ChronoTextPrimary else ChronoTextSecondary,
                maxLines = 1
            )
            if (isActive) {
                Spacer(Modifier.width(4.dp))
                Text("✓", color = Violet400, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
