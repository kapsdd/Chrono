package com.chrono.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.chrono.app.data.model.Task
import com.chrono.app.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun CalendarGrid(
    tasks: List<Task>,
    onDayClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val cal = remember { Calendar.getInstance() }
    var currentMonth by remember { mutableIntStateOf(cal.get(Calendar.MONTH)) }
    var currentYear by remember { mutableIntStateOf(cal.get(Calendar.YEAR)) }

    val monthNames = listOf(
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    )

    val tasksByDate = remember(tasks) {
        tasks.filter { it.due != null }.groupBy { it.due!!.substringBefore("T") }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        // Month navigation
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = {
                currentMonth--
                if (currentMonth < 0) { currentMonth = 11; currentYear-- }
            }) { Text("◀", color = ChronoTextSecondary) }

            Text(
                "${monthNames[currentMonth]} $currentYear",
                style = MaterialTheme.typography.titleLarge,
                color = ChronoTextPrimary
            )

            TextButton(onClick = {
                currentMonth++
                if (currentMonth > 11) { currentMonth = 0; currentYear++ }
            }) { Text("▶", color = ChronoTextSecondary) }
        }

        Spacer(Modifier.height(8.dp))

        // Day headers
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс").forEach { day ->
                Text(
                    text = day,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.labelSmall,
                    color = ChronoTextMuted
                )
            }
        }

        Spacer(Modifier.height(4.dp))

        // Calendar grid
        val firstDay = Calendar.getInstance().apply {
            set(currentYear, currentMonth, 1)
        }
        val daysInMonth = firstDay.getActualMaximum(Calendar.DAY_OF_MONTH)
        var startDay = firstDay.get(Calendar.DAY_OF_WEEK) - 2
        if (startDay < 0) startDay += 7

        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
        val totalCells = startDay + daysInMonth
        val rows = (totalCells + 6) / 7

        for (row in 0 until rows) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (col in 0..6) {
                    val idx = row * 7 + col - startDay
                    if (idx in 0 until daysInMonth) {
                        val day = idx + 1
                        val dateStr = String.format("%04d-%02d-%02d", currentYear, currentMonth + 1, day)
                        val dayTasks = tasksByDate[dateStr] ?: emptyList()
                        val isToday = dateStr == today

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .padding(2.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (isToday) Violet500.copy(alpha = 0.2f)
                                    else ChronoSurface.copy(alpha = 0.4f)
                                )
                                .clickable { onDayClick(dateStr) },
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "$day",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = if (isToday) Violet200 else ChronoTextPrimary
                                )
                                if (dayTasks.isNotEmpty()) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                        dayTasks.take(3).forEach {
                                            Box(
                                                Modifier
                                                    .size(4.dp)
                                                    .clip(RoundedCornerShape(2.dp))
                                                    .background(Violet400)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}
