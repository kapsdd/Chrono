package com.chrono.app.data.repository

import com.chrono.app.data.model.Task
import com.chrono.app.data.model.TaskNode

fun buildTree(tasks: List<Task>): List<TaskNode> {
    val byParent = tasks.groupBy { it.parentId }
    val visited = mutableSetOf<String>()

    fun walk(parentId: String?, depth: Int): List<TaskNode> {
        val children = (byParent[parentId] ?: emptyList())
            .sortedWith(compareBy<Task> { it.order }.thenByDescending { it.createdAt })
        return children.mapNotNull { task ->
            if (task.id in visited) return@mapNotNull null
            visited.add(task.id)
            TaskNode(
                task = task,
                children = walk(task.id, depth + 1),
                depth = depth
            )
        }
    }

    return walk(null, 0)
}
