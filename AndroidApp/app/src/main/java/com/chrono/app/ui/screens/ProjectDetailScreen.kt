package com.chrono.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.chrono.app.data.model.*
import com.chrono.app.data.repository.DEFAULT_KANBAN_COLUMNS
import com.chrono.app.data.repository.buildTree
import com.chrono.app.data.repository.normalizeKanbanColumns
import com.chrono.app.ui.components.*
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectDetailScreen(
    vm: MainViewModel,
    projectId: String,
    onBack: () -> Unit,
    onNavigateToTask: (String) -> Unit,
    onNavigateToMembers: () -> Unit
) {
    val projects by vm.projects.collectAsState()
    val tasks by vm.tasks.collectAsState()
    val project = projects.find { it.id == projectId }

    var projectView by remember(project) { mutableStateOf(project?.view ?: ProjectView.LIST) }
    var showLobbyDialog by remember { mutableStateOf(false) }
    var lobbyCode by remember { mutableStateOf<String?>(null) }
    var showColorPicker by remember { mutableStateOf(false) }

    val colorOptions = listOf(
        "#a78bfa", "#f472b6", "#22d3ee", "#facc15", "#34d399", "#fb7185",
        "#818cf8", "#f59e0b", "#ef4444", "#10b981", "#06b6d4", "#ec4899"
    )

    LaunchedEffect(projectId) { vm.setActiveProject(projectId) }

    val activeTasks = tasks.filter { it.projectId == projectId && !it.isCompleted }
        .sortedBy { it.order }
    val completedTasks = tasks.filter { it.projectId == projectId && it.isCompleted }
        .sortedByDescending { it.createdAt }
    val tree = remember(activeTasks) { buildTree(activeTasks) }
    val columns = remember(project) { normalizeKanbanColumns(project?.kanbanColumns) }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        val dotColor = try {
                            Color(android.graphics.Color.parseColor(project?.color ?: "#a78bfa"))
                        } catch (_: Exception) { Violet400 }
                        Box(
                            modifier = Modifier
                                .size(12.dp)
                                .clip(CircleShape)
                                .background(dotColor)
                                .clickable { showColorPicker = true }
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(project?.name ?: "Проект", color = ChronoTextPrimary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = { vm.setActiveProject(null); onBack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад", tint = ChronoTextPrimary)
                    }
                },
                actions = {
                    // View switcher
                    IconButton(onClick = {
                        projectView = when (projectView) {
                            ProjectView.LIST -> ProjectView.BOARD
                            ProjectView.BOARD -> ProjectView.GANTT
                            ProjectView.GANTT -> ProjectView.LIST
                        }
                    }) {
                        Icon(
                            when (projectView) {
                                ProjectView.LIST -> Icons.Default.ViewKanban
                                ProjectView.BOARD -> Icons.Default.Timeline
                                ProjectView.GANTT -> Icons.Default.List
                            },
                            contentDescription = "Вид",
                            tint = Violet400
                        )
                    }
                    IconButton(onClick = onNavigateToMembers) {
                        Icon(Icons.Default.People, "Участники", tint = ChronoTextSecondary)
                    }
                    IconButton(onClick = { showLobbyDialog = true }) {
                        Icon(Icons.Default.Share, "Поделиться", tint = ChronoTextSecondary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .chronoBackground()
                .padding(padding)
        ) {
            when (projectView) {
                ProjectView.LIST -> {
                    LazyColumn(
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        item {
                            SmartInput(onSubmit = { vm.addFromInput(it) })
                            Spacer(Modifier.height(8.dp))
                        }
                        items(tree, key = { it.task.id }) { node ->
                            TaskCard(
                                task = node.task,
                                onToggle = { vm.toggleComplete(node.task.id) },
                                onClick = { onNavigateToTask(node.task.id) },
                                onDelete = { vm.deleteTask(node.task.id) }
                            )
                        }
                        if (completedTasks.isNotEmpty()) {
                            item {
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    "Выполнено (${completedTasks.size})",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = ChronoTextMuted
                                )
                            }
                            items(completedTasks, key = { it.id }) { task ->
                                TaskCard(
                                    task = task,
                                    onToggle = { vm.toggleComplete(task.id) },
                                    onClick = { onNavigateToTask(task.id) },
                                    onDelete = { vm.deleteTask(task.id) }
                                )
                            }
                        }
                    }
                }
                ProjectView.BOARD -> {
                    LazyColumn(contentPadding = PaddingValues(16.dp)) {
                        item {
                            KanbanBoard(
                                tasks = activeTasks,
                                columns = columns,
                                onToggle = { vm.toggleComplete(it) },
                                onClick = { onNavigateToTask(it) },
                                onDelete = { vm.deleteTask(it) },
                                onMove = { id, priority -> vm.setPriority(id, priority) }
                            )
                        }
                    }
                }
                ProjectView.GANTT -> {
                    LazyColumn(contentPadding = PaddingValues(16.dp)) {
                        item {
                            GanttChart(tasks = activeTasks)
                        }
                    }
                }
            }
        }

        // Color picker dialog
        if (showColorPicker) {
            AlertDialog(
                onDismissRequest = { showColorPicker = false },
                containerColor = Color(0xCC140d28),
                title = { Text("Цвет проекта", color = ChronoTextPrimary) },
                text = {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        colorOptions.forEach { hex ->
                            val c = try {
                                Color(android.graphics.Color.parseColor(hex))
                            } catch (_: Exception) { Violet400 }
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(CircleShape)
                                    .background(c)
                                    .clickable {
                                        vm.setProjectColor(projectId, hex)
                                        showColorPicker = false
                                    }
                            )
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { showColorPicker = false }) {
                        Text("Отмена", color = ChronoTextMuted)
                    }
                }
            )
        }

        // Lobby dialog
        if (showLobbyDialog) {
            AlertDialog(
                onDismissRequest = { showLobbyDialog = false },
                containerColor = Color(0xCC140d28),
                title = { Text("Опубликовать лобби", color = ChronoTextPrimary) },
                text = {
                    Column {
                        if (lobbyCode != null) {
                            Text("Код для подключения:", color = ChronoTextSecondary)
                            Spacer(Modifier.height(8.dp))
                            Text(
                                lobbyCode!!,
                                style = MaterialTheme.typography.headlineMedium,
                                color = Violet200
                            )
                        } else {
                            Text(
                                "Создайте лобби, чтобы другие могли присоединиться к проекту",
                                color = ChronoTextSecondary
                            )
                        }
                    }
                },
                confirmButton = {
                    if (lobbyCode == null) {
                        TextButton(onClick = {
                            lobbyCode = vm.publishLobby(projectId, "")
                        }) {
                            Text("Опубликовать", color = Violet400)
                        }
                    } else {
                        TextButton(onClick = { showLobbyDialog = false }) {
                            Text("Готово", color = Violet400)
                        }
                    }
                },
                dismissButton = {
                    TextButton(onClick = {
                        if (lobbyCode != null) vm.unpublishLobby(projectId)
                        lobbyCode = null
                        showLobbyDialog = false
                    }) {
                        Text(if (lobbyCode != null) "Закрыть лобби" else "Отмена", color = ChronoTextMuted)
                    }
                }
            )
        }
    }
}
