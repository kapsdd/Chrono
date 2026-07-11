package com.chrono.app.data.model

typealias Priority = Int

const val PRIORITY_NONE: Priority = 0
const val PRIORITY_LOW: Priority = 1
const val PRIORITY_MEDIUM: Priority = 2
const val PRIORITY_HIGH: Priority = 3

enum class ProjectView { LIST, BOARD, GANTT }

enum class Recurrence { DAILY, WEEKLY, MONTHLY }

enum class Role { OWNER, ADMIN, EDITOR, VIEWER }

data class Task(
    val id: String = "",
    val title: String = "",
    val isCompleted: Boolean = false,
    val priority: Priority = PRIORITY_NONE,
    val parentId: String? = null,
    val projectId: String? = null,
    val tags: List<String> = emptyList(),
    val note: String = "",
    val order: Double = 0.0,
    val due: String? = null,
    val collapsed: Boolean = false,
    val timeSpent: Long = 0,
    val recurrence: Recurrence? = null,
    val streak: Int = 0,
    val lastCompletedAt: String? = null,
    val createdAt: String = ""
)

data class Project(
    val id: String = "",
    val ownerId: String? = null,
    val name: String = "",
    val shareId: String = "",
    val color: String = "#a78bfa",
    val shared: Boolean = false,
    val collaborators: List<Collaborator> = emptyList(),
    val view: ProjectView = ProjectView.LIST,
    val kanbanColumns: List<KanbanColumn> = emptyList(),
    val published: Boolean = false,
    val joinCode: String? = null,
    val createdAt: String = ""
)

data class KanbanColumn(
    val priority: Priority = PRIORITY_NONE,
    val label: String = "",
    val color: String = "#64748b"
)

data class Collaborator(
    val id: String = "",
    val name: String = "",
    val avatar: String? = null,
    val role: Role = Role.EDITOR,
    val addedAt: String = ""
)

data class Friend(
    val id: String = "",
    val name: String = "",
    val avatar: String? = null,
    val addedAt: String = ""
)

data class Note(
    val id: String = "",
    val title: String = "",
    val content: String = "",
    val pinned: Boolean = false,
    val color: String? = null,
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class Session(
    val id: String = "",
    val username: String = "",
    val avatar: String? = null,
    val provider: String = "google"
)

data class TaskNode(
    val task: Task,
    val children: List<TaskNode> = emptyList(),
    val depth: Int = 0
)

data class ParsedInput(
    val title: String = "",
    val project: String? = null,
    val tags: List<String> = emptyList(),
    val priority: Priority = PRIORITY_NONE
)
