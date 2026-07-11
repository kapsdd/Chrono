package com.chrono.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.chrono.app.data.model.*
import com.chrono.app.ui.components.GlassCard
import com.chrono.app.ui.components.PriorityChip
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskDetailScreen(
    vm: MainViewModel,
    taskId: String,
    onBack: () -> Unit
) {
    val tasks by vm.tasks.collectAsState()
    val task = tasks.find { it.id == taskId }

    var editTitle by remember(task) { mutableStateOf(task?.title ?: "") }
    var editNote by remember(task) { mutableStateOf(task?.note ?: "") }
    var selectedPriority by remember(task) { mutableIntStateOf(task?.priority ?: PRIORITY_NONE) }
    var selectedRecurrence by remember(task) { mutableStateOf(task?.recurrence) }

    // Auto-save on leave
    DisposableEffect(taskId) {
        onDispose {
            task?.let {
                vm.renameTask(it.id, editTitle)
                vm.setTaskNote(it.id, editNote)
                vm.setPriority(it.id, selectedPriority)
                vm.setRecurrence(it.id, selectedRecurrence)
            }
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Задача", color = ChronoTextPrimary) },
                navigationIcon = {
                    IconButton(onClick = {
                        task?.let {
                            vm.renameTask(it.id, editTitle)
                            vm.setTaskNote(it.id, editNote)
                            vm.setPriority(it.id, selectedPriority)
                            vm.setRecurrence(it.id, selectedRecurrence)
                        }
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад", tint = ChronoTextPrimary)
                    }
                },
                actions = {
                    task?.let {
                        IconButton(onClick = { vm.toggleComplete(it.id) }) {
                            Icon(
                                if (it.isCompleted) Icons.Default.Undo else Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = if (it.isCompleted) Amber500 else Emerald400
                            )
                        }
                        IconButton(onClick = { vm.deleteTask(it.id); onBack() }) {
                            Icon(Icons.Default.Delete, "Удалить", tint = Rose400)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        if (task == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .chronoBackground()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Text("Задача не найдена", color = ChronoTextMuted)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .chronoBackground()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Title
                OutlinedTextField(
                    value = editTitle,
                    onValueChange = { editTitle = it },
                    label = { Text("Название") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Violet400,
                        unfocusedBorderColor = ChronoBorder,
                        focusedLabelColor = Violet400,
                        cursorColor = Violet400
                    )
                )

                // Priority selector
                GlassCard {
                    Text("Приоритет", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(
                            PRIORITY_NONE to "Нет",
                            PRIORITY_LOW to "P1",
                            PRIORITY_MEDIUM to "P2",
                            PRIORITY_HIGH to "P3"
                        ).forEach { (p, label) ->
                            FilterChip(
                                selected = selectedPriority == p,
                                onClick = { selectedPriority = p },
                                label = { Text(label) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Violet500.copy(alpha = 0.2f),
                                    selectedLabelColor = Violet200
                                )
                            )
                        }
                    }
                }

                // Recurrence
                GlassCard {
                    Text("Повторение", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(
                            null to "Нет",
                            Recurrence.DAILY to "Ежедневно",
                            Recurrence.WEEKLY to "Еженедельно",
                            Recurrence.MONTHLY to "Ежемесячно"
                        ).forEach { (r, label) ->
                            FilterChip(
                                selected = selectedRecurrence == r,
                                onClick = { selectedRecurrence = r },
                                label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Violet500.copy(alpha = 0.2f),
                                    selectedLabelColor = Violet200
                                )
                            )
                        }
                    }
                    if (task.streak > 0) {
                        Spacer(Modifier.height(8.dp))
                        Text("🔥 Серия: ${task.streak}", color = Amber500, style = MaterialTheme.typography.bodyMedium)
                    }
                }

                // Time tracking
                GlassCard {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Время", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                            val h = task.timeSpent / 3600
                            val m = (task.timeSpent % 3600) / 60
                            Text(
                                "${h}ч ${m}м",
                                style = MaterialTheme.typography.headlineMedium,
                                color = Violet200
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(5, 15, 30, 60).forEach { min ->
                                OutlinedButton(
                                    onClick = { vm.addTime(task.id, min * 60L) },
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text("+${min}м", style = MaterialTheme.typography.labelSmall)
                                }
                            }
                        }
                    }
                }

                // Note
                OutlinedTextField(
                    value = editNote,
                    onValueChange = { editNote = it },
                    label = { Text("Заметка") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(min = 100.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Violet400,
                        unfocusedBorderColor = ChronoBorder,
                        focusedLabelColor = Violet400,
                        cursorColor = Violet400
                    )
                )

                // Tags
                if (task.tags.isNotEmpty()) {
                    GlassCard {
                        Text("Теги", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            task.tags.forEach { tag ->
                                SuggestionChip(
                                    onClick = {},
                                    label = { Text("#$tag") },
                                    colors = SuggestionChipDefaults.suggestionChipColors(
                                        containerColor = Violet500.copy(alpha = 0.1f),
                                        labelColor = Violet200
                                    )
                                )
                            }
                        }
                    }
                }

                // Info
                GlassCard {
                    Text("Информация", style = MaterialTheme.typography.titleMedium, color = ChronoTextPrimary)
                    Spacer(Modifier.height(8.dp))
                    InfoRow("Создано", task.createdAt.substringBefore("T"))
                    task.due?.let { InfoRow("Дедлайн", it.substringBefore("T")) }
                    InfoRow("ID", task.id.take(8) + "...")
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = ChronoTextMuted)
        Text(value, style = MaterialTheme.typography.bodySmall, color = ChronoTextSecondary)
    }
}
