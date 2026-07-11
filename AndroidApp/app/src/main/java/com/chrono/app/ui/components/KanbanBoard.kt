package com.chrono.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.chrono.app.data.model.*
import com.chrono.app.data.repository.DEFAULT_KANBAN_COLUMNS
import com.chrono.app.ui.theme.*

@Composable
fun KanbanBoard(
    tasks: List<Task>,
    columns: List<KanbanColumn>,
    onToggle: (String) -> Unit,
    onClick: (String) -> Unit,
    onDelete: (String) -> Unit,
    onMove: (String, Priority) -> Unit
) {
    val normalized = if (columns.isEmpty()) DEFAULT_KANBAN_COLUMNS else columns
    val grouped = tasks.groupBy { it.priority }

    Column(modifier = Modifier.fillMaxWidth()) {
        normalized.forEach { column ->
            val columnTasks = grouped[column.priority] ?: emptyList()
            val color = try {
                Color(android.graphics.Color.parseColor(column.color))
            } catch (_: Exception) { ChronoMuted }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(start = 4.dp, bottom = 6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(color)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = column.label,
                        style = MaterialTheme.typography.titleMedium,
                        color = ChronoTextPrimary
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "${columnTasks.size}",
                        style = MaterialTheme.typography.labelSmall,
                        color = ChronoTextMuted
                    )
                }

                if (columnTasks.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .border(1.dp, ChronoBorder, RoundedCornerShape(12.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Нет задач", style = MaterialTheme.typography.bodySmall, color = ChronoTextMuted)
                    }
                } else {
                    columnTasks.forEach { task ->
                        TaskCard(
                            task = task,
                            onToggle = { onToggle(task.id) },
                            onClick = { onClick(task.id) },
                            onDelete = { onDelete(task.id) },
                            modifier = Modifier.padding(vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun GanttChart(tasks: List<Task>, modifier: Modifier = Modifier) {
    if (tasks.isEmpty()) {
        Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Нет задач для отображения", color = ChronoTextMuted)
        }
        return
    }

    val now = System.currentTimeMillis()
    val tasksWithDue = tasks.filter { it.due != null }
    val minTime = tasksWithDue.minOfOrNull { parseTime(it.createdAt) } ?: now
    val maxTime = tasksWithDue.maxOfOrNull { parseTime(it.due!!) } ?: (now + 7 * 86_400_000L)
    val totalRange = (maxTime - minTime).coerceAtLeast(86_400_000L)

    Column(modifier = modifier.fillMaxWidth()) {
        tasks.forEach { task ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = task.title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = ChronoTextPrimary,
                    modifier = Modifier.width(100.dp),
                    maxLines = 1
                )
                if (task.due != null) {
                    val start = ((parseTime(task.createdAt) - minTime).toFloat() / totalRange).coerceIn(0f, 1f)
                    val end = ((parseTime(task.due!!) - minTime).toFloat() / totalRange).coerceIn(start, 1f)
                    val widthFraction = (end - start).coerceAtLeast(0.05f)

                    Row(modifier = Modifier.weight(1f)) {
                        Spacer(modifier = Modifier.weight(start))
                        Box(
                            modifier = Modifier
                                .weight(widthFraction)
                                .height(24.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(priorityColor(task.priority).copy(alpha = 0.4f))
                        )
                        Spacer(modifier = Modifier.weight(1f - start - widthFraction))
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(24.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(ChronoSurface)
                    )
                }
            }
        }
    }
}

private fun parseTime(iso: String): Long {
    return try {
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).parse(iso)?.time ?: 0L
    } catch (_: Exception) { 0L }
}

private fun priorityColor(p: Priority): Color = when (p) {
    PRIORITY_HIGH -> Rose400
    PRIORITY_MEDIUM -> Amber500
    PRIORITY_LOW -> Violet400
    else -> Slate500
}
