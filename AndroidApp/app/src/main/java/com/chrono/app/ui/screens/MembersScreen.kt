package com.chrono.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.chrono.app.data.model.Collaborator
import com.chrono.app.data.model.Role
import com.chrono.app.ui.components.GlassCard
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MembersScreen(
    vm: MainViewModel,
    projectId: String,
    onBack: () -> Unit
) {
    val projects by vm.projects.collectAsState()
    val project = projects.find { it.id == projectId }
    val collaborators = project?.collaborators ?: emptyList()

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Участники", color = ChronoTextPrimary) },
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
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Text(
                    "${collaborators.size} участник(ов)",
                    style = MaterialTheme.typography.bodyMedium,
                    color = ChronoTextMuted
                )
                Spacer(Modifier.height(8.dp))
            }

            items(collaborators, key = { it.id }) { collab ->
                GlassCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(Violet500, Fuchsia500))),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                collab.name.firstOrNull()?.uppercase() ?: "?",
                                style = MaterialTheme.typography.titleMedium,
                                color = Color.White
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(collab.name, style = MaterialTheme.typography.bodyLarge, color = ChronoTextPrimary)
                            Text(
                                roleLabel(collab.role),
                                style = MaterialTheme.typography.labelSmall,
                                color = when (collab.role) {
                                    Role.OWNER -> Amber500
                                    Role.ADMIN -> Violet400
                                    Role.EDITOR -> Emerald400
                                    Role.VIEWER -> ChronoTextMuted
                                }
                            )
                        }
                    }
                }
            }

            if (collaborators.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.People, null, tint = ChronoTextMuted, modifier = Modifier.size(48.dp))
                            Spacer(Modifier.height(12.dp))
                            Text("Нет участников", color = ChronoTextSecondary)
                            Text(
                                "Опубликуйте лобби, чтобы пригласить",
                                style = MaterialTheme.typography.bodySmall,
                                color = ChronoTextMuted
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun roleLabel(role: Role): String = when (role) {
    Role.OWNER -> "Владелец"
    Role.ADMIN -> "Администратор"
    Role.EDITOR -> "Редактор"
    Role.VIEWER -> "Наблюдатель"
}
