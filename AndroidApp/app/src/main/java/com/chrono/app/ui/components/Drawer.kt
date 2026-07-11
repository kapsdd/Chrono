package com.chrono.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.chrono.app.data.model.Project
import com.chrono.app.data.model.Session
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel
import androidx.compose.foundation.BorderStroke

@Composable
fun ChronoDrawer(
    projects: List<Project>,
    session: Session?,
    activeView: MainViewModel.ViewId,
    activeProjectId: String?,
    onSelectView: (MainViewModel.ViewId) -> Unit,
    onSelectProject: (String) -> Unit,
    onCreateProject: (String) -> Unit,
    onJoinLobby: () -> Unit,
    onClose: () -> Unit
) {
    val theme = ThemeStore.currentTheme()

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(280.dp)
            .background(
                Brush.verticalGradient(
                    colors = listOf(theme.bgFrom, theme.bgMid, theme.bgTo)
                )
            )
            .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.10f)))
            .padding(16.dp)
    ) {
        // User avatar
        session?.let {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 20.dp)) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(Violet500, Fuchsia500))),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = it.username.firstOrNull()?.uppercase() ?: "?",
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White
                    )
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    text = it.username,
                    style = MaterialTheme.typography.bodyLarge,
                    color = ChronoTextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        // Main views
        DrawerItem(Icons.Default.Star, "Сегодня", activeView == MainViewModel.ViewId.TODAY) {
            onSelectView(MainViewModel.ViewId.TODAY); onClose()
        }
        DrawerItem(Icons.Default.List, "Планы", activeView == MainViewModel.ViewId.PLANS) {
            onSelectView(MainViewModel.ViewId.PLANS); onClose()
        }
        DrawerItem(Icons.Default.CalendarMonth, "Календарь", activeView == MainViewModel.ViewId.CALENDAR) {
            onSelectView(MainViewModel.ViewId.CALENDAR); onClose()
        }
        DrawerItem(Icons.Default.Repeat, "Привычки", activeView == MainViewModel.ViewId.HABITS) {
            onSelectView(MainViewModel.ViewId.HABITS); onClose()
        }
        DrawerItem(Icons.Default.StickyNote2, "Заметки", activeView == MainViewModel.ViewId.NOTES) {
            onSelectView(MainViewModel.ViewId.NOTES); onClose()
        }

        Spacer(Modifier.height(12.dp))

        // Projects section
        Text(
            "ПРОЕКТЫ",
            style = MaterialTheme.typography.labelSmall,
            color = ChronoTextMuted,
            modifier = Modifier.padding(start = 12.dp, bottom = 6.dp)
        )

        projects.forEach { project ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { onSelectProject(project.id); onClose() }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                val color = try {
                    Color(android.graphics.Color.parseColor(project.color))
                } catch (_: Exception) { Violet400 }
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(color)
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = project.name,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (activeProjectId == project.id) ChronoTextPrimary else ChronoTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        // New project input
        var newProjectName by remember { mutableStateOf("") }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Default.Add, contentDescription = null, tint = ChronoTextMuted, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            OutlinedTextField(
                value = newProjectName,
                onValueChange = { newProjectName = it },
                placeholder = { Text("Новый проект", style = MaterialTheme.typography.bodySmall, color = ChronoTextMuted) },
                singleLine = true,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Violet400,
                    unfocusedBorderColor = ChronoTextMuted.copy(alpha = 0.3f),
                    cursorColor = Violet400
                ),
                textStyle = MaterialTheme.typography.bodySmall,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = {
                    if (newProjectName.isNotBlank()) {
                        onCreateProject(newProjectName.trim())
                        newProjectName = ""
                    }
                })
            )
        }

        // Join lobby button
        Spacer(Modifier.height(8.dp))
        OutlinedButton(
            onClick = { onJoinLobby(); onClose() },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = Violet400,
                containerColor = Color.White.copy(alpha = 0.04f)
            ),
            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(6.dp))
            Text("Присоединиться", style = MaterialTheme.typography.labelLarge)
        }

        Spacer(Modifier.weight(1f))

        // Settings
        DrawerItem(Icons.Default.Settings, "Настройки", activeView == MainViewModel.ViewId.SETTINGS) {
            onSelectView(MainViewModel.ViewId.SETTINGS); onClose()
        }
    }
}

@Composable
private fun DrawerItem(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    val bg = if (selected) Color.White.copy(alpha = 0.10f) else Color.Transparent
    val textColor = if (selected) ChronoTextPrimary else ChronoTextSecondary
    val iconColor = if (selected) Violet400 else ChronoTextMuted

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .then(
                if (selected) Modifier.border(
                    BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                    RoundedCornerShape(10.dp)
                ) else Modifier
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(12.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = textColor)
    }
}
