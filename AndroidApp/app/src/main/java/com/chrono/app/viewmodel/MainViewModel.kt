package com.chrono.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.chrono.app.data.model.*
import com.chrono.app.data.repository.*
import com.chrono.app.widget.*
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = FirebaseRepository()

    private val _tasks = MutableStateFlow<List<Task>>(emptyList())
    private val _projects = MutableStateFlow<List<Project>>(emptyList())
    private val _friends = MutableStateFlow<List<Friend>>(emptyList())
    private val _session = MutableStateFlow<Session?>(null)
    private val _ready = MutableStateFlow(false)

    val tasks: StateFlow<List<Task>> = _tasks.asStateFlow()
    val projects: StateFlow<List<Project>> = _projects.asStateFlow()
    val friends: StateFlow<List<Friend>> = _friends.asStateFlow()
    val session: StateFlow<Session?> = _session.asStateFlow()
    val ready: StateFlow<Boolean> = _ready.asStateFlow()

    private val _activeView = MutableStateFlow(ViewId.PLANS)
    private val _activeProjectId = MutableStateFlow<String?>(null)
    private val _query = MutableStateFlow("")

    val activeView: StateFlow<ViewId> = _activeView.asStateFlow()
    val activeProjectId: StateFlow<String?> = _activeProjectId.asStateFlow()
    val query: StateFlow<String> = _query.asStateFlow()

    private val _notes = MutableStateFlow<List<Note>>(emptyList())
    val notes: StateFlow<List<Note>> = _notes.asStateFlow()

    enum class ViewId {
        INBOX, TODAY, PLANS, CALENDAR, HABITS, NOTES, PROJECT, NOPROJECT, SOMEDAY, ARCHIVE, TRASH, SETTINGS
    }

    init {
        viewModelScope.launch {
            repo.authStateFlow().collect { isAuth ->
                if (isAuth) {
                    val user = repo.currentUser
                    if (user != null) {
                        _session.value = Session(
                            id = user.uid,
                            username = user.displayName ?: "User",
                            avatar = user.photoUrl?.toString(),
                            provider = "google"
                        )
                        loadData()
                    }
                } else {
                    _session.value = null
                    _tasks.value = emptyList()
                    _projects.value = emptyList()
                    _friends.value = emptyList()
                    _ready.value = true
                }
            }
        }
    }

    private fun loadData() {
        viewModelScope.launch {
            repo.fetchAllFlow().collect { snap ->
                _projects.value = snap.projects
                _tasks.value = snap.tasks
                _notes.value = snap.notes
                _friends.value = snap.friends
                _ready.value = true
                refreshWidgets()
            }
        }
    }

    private fun refreshWidgets() {
        val ctx = getApplication<Application>()
        TasksWidgetProvider.updateAll(ctx)
        HabitsWidgetProvider.updateAll(ctx)
        NotesWidgetProvider.updateAll(ctx)
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            try {
                repo.signInWithGoogle(idToken)
            } catch (_: Exception) {}
        }
    }

    fun signOut() {
        repo.signOut()
    }

    fun setView(view: ViewId) {
        _activeView.value = view
        if (view != ViewId.PROJECT) _activeProjectId.value = null
    }

    fun setActiveProject(id: String?) {
        _activeProjectId.value = id
        if (id != null) _activeView.value = ViewId.PROJECT
    }

    fun setQuery(q: String) { _query.value = q }

    fun addFromInput(raw: String, parentId: String? = null) {
        val parsed = parseInput(raw)
        if (parsed.title.isBlank()) return
        val uid = repo.currentUser?.uid ?: return

        var projectId = _activeProjectId.value
        if (parentId != null) {
            projectId = _tasks.value.find { it.id == parentId }?.projectId ?: projectId
        }
        if (parsed.project != null) {
            projectId = findOrCreateProject(parsed.project)
        }

        val minOrder = _tasks.value.minOfOrNull { it.order } ?: 0.0
        val task = Task(
            id = uuid(),
            title = parsed.title,
            isCompleted = false,
            priority = parsed.priority,
            parentId = parentId,
            projectId = projectId,
            tags = parsed.tags,
            note = "",
            order = minOrder - 1,
            createdAt = nowIso()
        )
        _tasks.value = _tasks.value + task
        viewModelScope.launch { repo.upsertTask(task, uid) }
        refreshWidgets()
    }

    fun renameTask(id: String, title: String) {
        patchTask(id) { it.copy(title = title.trim()) }
    }

    fun toggleComplete(id: String) {
        val task = _tasks.value.find { it.id == id } ?: return
        val uid = repo.currentUser?.uid ?: return

        if (task.recurrence != null && !task.isCompleted) {
            val now = System.currentTimeMillis()
            val periodMs = when (task.recurrence) {
                Recurrence.DAILY -> 86_400_000L
                Recurrence.WEEKLY -> 7 * 86_400_000L
                Recurrence.MONTHLY -> 30 * 86_400_000L
            }
            val lastTime = task.lastCompletedAt?.let { parseIso(it) } ?: 0L
            val gap = now - lastTime
            val streak = if (gap in 0..(periodMs * 1.5).toLong()) task.streak + 1 else 1
            val base = maxOf(now, task.due?.let { parseIso(it) } ?: now)
            val newDue = Date(base + periodMs).let { formatIso(it) }

            val updated = task.copy(
                streak = streak,
                lastCompletedAt = nowIso(),
                due = newDue
            )
            _tasks.value = _tasks.value.map { if (it.id == id) updated else it }
            viewModelScope.launch { repo.upsertTask(updated, uid) }
        } else {
            val next = !task.isCompleted
            val descendants = mutableSetOf(id)
            if (next) {
                var grew = true
                while (grew) {
                    grew = false
                    for (t in _tasks.value) {
                        if (t.parentId != null && t.parentId in descendants && t.id !in descendants) {
                            descendants.add(t.id)
                            grew = true
                        }
                    }
                }
            }
            val updated = _tasks.value.map { t ->
                if (t.id in descendants) t.copy(isCompleted = next) else t
            }
            _tasks.value = updated
            viewModelScope.launch { repo.upsertTasks(updated.filter { it.id in descendants }, uid) }
        }
        refreshWidgets()
    }

    fun deleteTask(id: String) {
        val uid = repo.currentUser?.uid ?: return
        val doomed = mutableSetOf(id)
        var grew = true
        while (grew) {
            grew = false
            for (t in _tasks.value) {
                if (t.parentId != null && t.parentId in doomed && t.id !in doomed) {
                    doomed.add(t.id)
                    grew = true
                }
            }
        }
        val taskMap = _tasks.value.filter { it.id in doomed }.associate { it.id to it.projectId }
        _tasks.value = _tasks.value.filter { it.id !in doomed }
        viewModelScope.launch { repo.deleteTasks(doomed.toList(), uid, taskMap) }
        refreshWidgets()
    }

    fun setTaskDue(id: String, due: String?) = patchTask(id) { it.copy(due = due) }
    fun setPriority(id: String, priority: Priority) = patchTask(id) { it.copy(priority = priority) }
    fun setTaskNote(id: String, note: String) = patchTask(id) { it.copy(note = note) }
    fun setTaskOrder(id: String, order: Double) = patchTask(id) { it.copy(order = order) }

    fun addTime(id: String, seconds: Long) {
        if (seconds <= 0) return
        patchTask(id) { it.copy(timeSpent = it.timeSpent + seconds) }
    }

    fun setRecurrence(id: String, recurrence: Recurrence?) {
        patchTask(id) {
            it.copy(
                recurrence = recurrence,
                due = if (recurrence != null && it.due == null) {
                    val base = System.currentTimeMillis()
                    val period = when (recurrence) {
                        Recurrence.DAILY -> 86_400_000L
                        Recurrence.WEEKLY -> 7 * 86_400_000L
                        Recurrence.MONTHLY -> 30 * 86_400_000L
                    }
                    formatIso(Date(base + period))
                } else it.due,
                streak = if (recurrence != null) it.streak else 0
            )
        }
    }

    fun createProject(name: String): String? {
        val trimmed = name.trim()
        if (trimmed.isBlank()) return null
        val existing = _projects.value.find { it.name.equals(trimmed, ignoreCase = true) }
        if (existing != null) return existing.id
        val uid = repo.currentUser?.uid
        val colors = listOf("#a78bfa", "#f472b6", "#22d3ee", "#facc15", "#34d399", "#fb7185", "#818cf8")
        val project = Project(
            id = uuid(),
            ownerId = uid,
            name = trimmed,
            shareId = uuid(),
            color = colors[_projects.value.size % colors.size],
            kanbanColumns = DEFAULT_KANBAN_COLUMNS,
            createdAt = nowIso()
        )
        _projects.value = _projects.value + project
        if (uid != null) viewModelScope.launch { repo.upsertProject(project, uid) }
        return project.id
    }

    fun renameProject(id: String, name: String) {
        val uid = repo.currentUser?.uid ?: return
        patchProject(id) { it.copy(name = name.trim()) }
    }

    fun setProjectColor(id: String, color: String) {
        patchProject(id) { it.copy(color = color) }
    }

    fun deleteProject(id: String) {
        val uid = repo.currentUser?.uid ?: return
        _projects.value = _projects.value.filter { it.id != id }
        _tasks.value = _tasks.value.filter { it.projectId != id }
        if (_activeProjectId.value == id) {
            _activeProjectId.value = null
            _activeView.value = ViewId.PLANS
        }
        viewModelScope.launch { repo.deleteProject(id, uid) }
    }

    fun toggleCollapse(id: String) = patchTask(id) { it.copy(collapsed = !it.collapsed) }

    fun publishLobby(projectId: String, password: String): String? {
        val uid = repo.currentUser?.uid ?: return null
        val project = _projects.value.find { it.id == projectId } ?: return null
        val code = makeJoinCode()
        viewModelScope.launch {
            repo.publishProject(projectId, code, password, project, uid)
            patchProject(projectId) { it.copy(published = true, joinCode = code, shared = true) }
        }
        return code
    }

    fun unpublishLobby(projectId: String) {
        viewModelScope.launch {
            repo.unpublishProject(projectId)
            patchProject(projectId) { it.copy(published = false, joinCode = null, shared = false) }
        }
    }

    // --- Notes CRUD ---

    fun createNote(title: String = "Без названия"): Note {
        val uid = repo.currentUser?.uid ?: return Note()
        val note = Note(
            id = uuid(),
            title = title,
            content = "",
            pinned = false,
            createdAt = nowIso(),
            updatedAt = nowIso()
        )
        _notes.value = listOf(note) + _notes.value
        viewModelScope.launch { repo.upsertNote(note, uid) }
        refreshWidgets()
        return note
    }

    fun updateNote(id: String, patch: Note.() -> Note) {
        val uid = repo.currentUser?.uid ?: return
        var updated: Note? = null
        _notes.value = _notes.value.map { n ->
            if (n.id == id) { updated = n.patch().copy(updatedAt = nowIso()); updated!! } else n
        }
        updated?.let { viewModelScope.launch { repo.upsertNote(it, uid) } }
        refreshWidgets()
    }

    fun deleteNote(id: String) {
        val uid = repo.currentUser?.uid ?: return
        _notes.value = _notes.value.filter { it.id != id }
        viewModelScope.launch { repo.deleteNote(id, uid) }
        refreshWidgets()
    }

    fun togglePinNote(id: String) {
        updateNote(id) { copy(pinned = !pinned) }
    }

    suspend fun joinLobby(code: String, password: String, name: String?, avatar: String?): Result<String> {
        val uid = repo.currentUser?.uid ?: return Result.failure(Exception("Не авторизован"))
        return try {
            val projectId = repo.joinProject(code, password, uid, name, avatar)
            _activeProjectId.value = projectId
            _activeView.value = ViewId.PROJECT
            Result.success(projectId)
        } catch (e: Exception) {
            android.util.Log.e("CHRONO", "joinLobby failed", e)
            Result.failure(e)
        }
    }

    private fun findOrCreateProject(name: String): String {
        val existing = _projects.value.find { it.name.equals(name.trim(), ignoreCase = true) }
        if (existing != null) return existing.id
        return createProject(name) ?: ""
    }

    private fun patchTask(id: String, transform: (Task) -> Task) {
        val uid = repo.currentUser?.uid ?: return
        var updated: Task? = null
        _tasks.value = _tasks.value.map { t ->
            if (t.id == id) { updated = transform(t); updated!! } else t
        }
        updated?.let { viewModelScope.launch { repo.upsertTask(it, uid) } }
    }

    private fun patchProject(id: String, transform: (Project) -> Project) {
        val uid = repo.currentUser?.uid ?: return
        var updated: Project? = null
        _projects.value = _projects.value.map { p ->
            if (p.id == id) { updated = transform(p); updated!! } else p
        }
        updated?.let { viewModelScope.launch { repo.upsertProject(it, uid) } }
    }

    fun getActiveTasks(): List<Task> {
        val view = _activeView.value
        val pid = _activeProjectId.value
        val q = _query.value.trim().lowercase()
        val match: (String) -> Boolean = { q.isEmpty() || it.lowercase().contains(q) }

        val filtered = when (view) {
            ViewId.INBOX, ViewId.NOPROJECT -> _tasks.value.filter { it.projectId == null && !it.isCompleted }
            ViewId.PROJECT -> _tasks.value.filter { it.projectId == pid && !it.isCompleted }
            ViewId.HABITS -> _tasks.value.filter { it.recurrence != null && !it.isCompleted }
            ViewId.ARCHIVE -> emptyList()
            else -> _tasks.value.filter { !it.isCompleted }
        }
        return filtered.filter { match(it.title) }.sortedBy { it.order }
    }

    fun getCompletedTasks(): List<Task> {
        val view = _activeView.value
        val pid = _activeProjectId.value
        val q = _query.value.trim().lowercase()
        val match: (String) -> Boolean = { q.isEmpty() || it.lowercase().contains(q) }

        return when (view) {
            ViewId.PROJECT -> _tasks.value.filter { it.isCompleted && it.projectId == pid }
            ViewId.INBOX, ViewId.NOPROJECT -> _tasks.value.filter { it.isCompleted && it.projectId == null }
            ViewId.ARCHIVE -> _tasks.value.filter { it.isCompleted }
            ViewId.PLANS, ViewId.CALENDAR -> _tasks.value.filter { it.isCompleted }
            else -> emptyList()
        }.filter { match(it.title) }.sortedByDescending { it.createdAt }
    }

    fun getCompletedCount(): Int = _tasks.value.count { it.isCompleted }
}

private fun uuid(): String = UUID.randomUUID().toString()
private fun nowIso(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
private fun parseIso(s: String): Long = try {
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).parse(s)?.time ?: 0L
} catch (_: Exception) { 0L }
private fun formatIso(d: Date): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(d)
private fun makeJoinCode(): String {
    val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    fun pick(n: Int) = (1..n).map { chars.random() }.joinToString("")
    return "${pick(3)}-${pick(3)}"
}
