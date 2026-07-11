package com.chrono.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.chrono.app.data.model.*
import com.chrono.app.data.repository.DEFAULT_KANBAN_COLUMNS
import com.chrono.app.data.repository.buildTree
import com.chrono.app.ui.components.*
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    vm: MainViewModel,
    onNavigateToSettings: () -> Unit,
    onNavigateToNotes: () -> Unit,
    onNavigateToProject: (String) -> Unit,
    onNavigateToTask: (String) -> Unit,
    onNavigateToLobby: () -> Unit,
    onSignOut: () -> Unit
) {
    val session by vm.session.collectAsState()
    val tasks by vm.tasks.collectAsState()
    val projects by vm.projects.collectAsState()
    val activeView by vm.activeView.collectAsState()
    val activeProjectId by vm.activeProjectId.collectAsState()
    val ready by vm.ready.collectAsState()

    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { vm.setView(MainViewModel.ViewId.PLANS) }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = Color.Transparent
            ) {
                ChronoDrawer(
                    projects = projects,
                    session = session,
                    activeView = activeView,
                    activeProjectId = activeProjectId,
                    onSelectView = { view ->
                        when (view) {
                            MainViewModel.ViewId.NOTES -> onNavigateToNotes()
                            MainViewModel.ViewId.SETTINGS -> onNavigateToSettings()
                            else -> vm.setView(view)
                        }
                    },
                    onSelectProject = { onNavigateToProject(it) },
                    onCreateProject = { name -> vm.createProject(name) },
                    onJoinLobby = onNavigateToLobby,
                    onClose = { scope.launch { drawerState.close() } }
                )
            }
        }
    ) {
        val currentTheme = ThemeStore.currentTheme()
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                text = viewTitle(activeView),
                                style = MaterialTheme.typography.titleLarge,
                                color = ChronoTextPrimary
                            )
                            if (ready) {
                                val active = vm.getActiveTasks()
                                val completed = vm.getCompletedTasks()
                                Text(
                                    "${active.size} активных · ${completed.size} выполнено",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = ChronoTextMuted
                                )
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, "Меню", tint = ChronoTextPrimary)
                        }
                    },
                    actions = {
                        IconButton(onClick = onNavigateToSettings) {
                            Icon(Icons.Default.Person, "Профиль", tint = ChronoTextSecondary)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Black.copy(alpha = 0.4f)
                    )
                )
            }
        ) { padding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .chronoBackground()
                    .padding(padding)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(chronoGlow1(currentTheme))
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(chronoGlow2(currentTheme))
                )
                when (activeView) {
                    MainViewModel.ViewId.CALENDAR -> {
                        CalendarViewContent(vm = vm, onNavigateToTask = onNavigateToTask)
                    }
                    MainViewModel.ViewId.HABITS -> {
                        HabitsViewContent(vm = vm, onNavigateToTask = onNavigateToTask)
                    }
                    else -> {
                        TaskListView(
                            vm = vm,
                            onNavigateToTask = onNavigateToTask
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TaskListView(
    vm: MainViewModel,
    onNavigateToTask: (String) -> Unit
) {
    val tasks by vm.tasks.collectAsState()
    val activeTasks = vm.getActiveTasks()
    val completedTasks = vm.getCompletedTasks()
    val tree = remember(activeTasks) { buildTree(activeTasks) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        item {
            SmartInput(onSubmit = { vm.addFromInput(it) })
            Spacer(Modifier.height(8.dp))
        }

        if (tree.isEmpty() && completedTasks.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 60.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Inbox,
                            contentDescription = null,
                            tint = ChronoTextMuted,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "Тут пока ничего нет",
                            style = MaterialTheme.typography.titleMedium,
                            color = ChronoTextSecondary
                        )
                        Text(
                            "Создайте первую задачу",
                            style = MaterialTheme.typography.bodySmall,
                            color = ChronoTextMuted
                        )
                    }
                }
            }
        }

        items(tree, key = { it.task.id }) { node ->
            TaskTreeNode(
                node = node,
                onToggle = { vm.toggleComplete(it) },
                onClick = { onNavigateToTask(it) },
                onDelete = { vm.deleteTask(it) }
            )
        }

        if (completedTasks.isNotEmpty()) {
            item {
                Spacer(Modifier.height(12.dp))
                Text(
                    "Выполнено (${completedTasks.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = ChronoTextMuted,
                    modifier = Modifier.padding(vertical = 4.dp)
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

@Composable
private fun TaskTreeNode(
    node: com.chrono.app.data.model.TaskNode,
    onToggle: (String) -> Unit,
    onClick: (String) -> Unit,
    onDelete: (String) -> Unit
) {
    Column(modifier = Modifier.padding(start = (node.depth * 16).dp)) {
        TaskCard(
            task = node.task,
            onToggle = { onToggle(node.task.id) },
            onClick = { onClick(node.task.id) },
            onDelete = { onDelete(node.task.id) }
        )
        node.children.forEach { child ->
            TaskTreeNode(
                node = child,
                onToggle = onToggle,
                onClick = onClick,
                onDelete = onDelete
            )
        }
    }
}

@Composable
private fun CalendarViewContent(vm: MainViewModel, onNavigateToTask: (String) -> Unit) {
    val tasks by vm.tasks.collectAsState()
    var selectedDate by remember { mutableStateOf<String?>(null) }

    val filteredTasks = if (selectedDate != null) {
        tasks.filter { it.due?.startsWith(selectedDate!!) == true && !it.isCompleted }
    } else {
        tasks.filter { it.due != null && !it.isCompleted }.sortedBy { it.due }
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            CalendarGrid(
                tasks = tasks,
                onDayClick = { date -> selectedDate = if (selectedDate == date) null else date }
            )
            if (selectedDate != null) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "Задачи на $selectedDate",
                    style = MaterialTheme.typography.labelMedium,
                    color = Violet400
                )
            }
        }
        items(filteredTasks, key = { it.id }) { task ->
            TaskCard(
                task = task,
                onToggle = { vm.toggleComplete(task.id) },
                onClick = { onNavigateToTask(task.id) },
                onDelete = { vm.deleteTask(task.id) }
            )
        }
    }
}

@Composable
private fun HabitsViewContent(vm: MainViewModel, onNavigateToTask: (String) -> Unit) {
    val tasks by vm.tasks.collectAsState()
    val habits = tasks.filter { it.recurrence != null && !it.isCompleted }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (habits.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 60.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Repeat,
                            contentDescription = null,
                            tint = ChronoTextMuted,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text("Нет привычек", color = ChronoTextSecondary)
                    }
                }
            }
        }
        items(habits, key = { it.id }) { task ->
            Card(
                colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.06f)),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color.White.copy(alpha = 0.10f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(task.title, style = MaterialTheme.typography.bodyLarge, color = ChronoTextPrimary)
                        Spacer(Modifier.height(4.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            val recLabel = when (task.recurrence) {
                                Recurrence.DAILY -> "Ежедневно"
                                Recurrence.WEEKLY -> "Еженедельно"
                                Recurrence.MONTHLY -> "Ежемесячно"
                                null -> ""
                            }
                            Text(recLabel, style = MaterialTheme.typography.labelSmall, color = Violet400)
                            if (task.streak > 0) {
                                Text(
                                    "🔥 ${task.streak}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Amber500
                                )
                            }
                        }
                    }
                    Button(
                        onClick = { vm.toggleComplete(task.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = Violet500),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("✓ Готово")
                    }
                }
            }
        }
    }
}

private fun viewTitle(view: MainViewModel.ViewId): String = when (view) {
    MainViewModel.ViewId.INBOX -> "Входящие"
    MainViewModel.ViewId.TODAY -> "Сегодня"
    MainViewModel.ViewId.PLANS -> "Планы"
    MainViewModel.ViewId.CALENDAR -> "Календарь"
    MainViewModel.ViewId.HABITS -> "Привычки"
    MainViewModel.ViewId.NOTES -> "Заметки"
    MainViewModel.ViewId.PROJECT -> "Проект"
    MainViewModel.ViewId.NOPROJECT -> "Без проекта"
    MainViewModel.ViewId.SOMEDAY -> "Когда-нибудь"
    MainViewModel.ViewId.ARCHIVE -> "Архив"
    MainViewModel.ViewId.TRASH -> "Корзина"
    MainViewModel.ViewId.SETTINGS -> "Настройки"
}
