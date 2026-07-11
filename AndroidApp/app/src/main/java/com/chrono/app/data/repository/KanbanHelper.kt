package com.chrono.app.data.repository

import com.chrono.app.data.model.KanbanColumn
import com.chrono.app.data.model.PRIORITY_HIGH
import com.chrono.app.data.model.PRIORITY_LOW
import com.chrono.app.data.model.PRIORITY_MEDIUM
import com.chrono.app.data.model.PRIORITY_NONE
import com.chrono.app.data.model.Priority

val DEFAULT_KANBAN_COLUMNS = listOf(
    KanbanColumn(PRIORITY_HIGH, "Срочно", "#fb7185"),
    KanbanColumn(PRIORITY_MEDIUM, "Высокий", "#f59e0b"),
    KanbanColumn(PRIORITY_LOW, "Средний", "#a78bfa"),
    KanbanColumn(PRIORITY_NONE, "Без приоритета", "#64748b")
)

fun normalizeKanbanColumns(columns: List<KanbanColumn>?): List<KanbanColumn> {
    if (columns == null || columns.isEmpty()) return DEFAULT_KANBAN_COLUMNS
    val map = columns.associateBy { it.priority }
    return DEFAULT_KANBAN_COLUMNS.map { def ->
        map[def.priority]?.let { c ->
            val safeColor = if (c.color.matches(Regex("^#[0-9a-fA-F]{6}$"))) c.color else def.color
            c.copy(label = c.label.ifBlank { def.label }, color = safeColor)
        } ?: def
    }
}
