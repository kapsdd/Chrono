package com.chrono.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.chrono.app.data.model.Note
import com.chrono.app.ui.components.GlassCard
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel

private val NOTE_COLORS = listOf(
    null to "Без цвета",
    "#7c3aed" to "Фиолетовый",
    "#2563eb" to "Синий",
    "#059669" to "Зелёный",
    "#d97706" to "Оранжевый",
    "#dc2626" to "Красный",
    "#db2777" to "Розовый",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotesScreen(vm: MainViewModel, onBack: () -> Unit) {
    val notes by vm.notes.collectAsState()
    var activeNoteId by remember { mutableStateOf<String?>(null) }
    var editTitle by remember { mutableStateOf("") }
    var editContent by remember { mutableStateOf("") }
    var editColor by remember { mutableStateOf<String?>(null) }
    var editPinned by remember { mutableStateOf(false) }

    val sortedNotes = remember(notes) {
        notes.sortedWith(compareByDescending<Note> { it.pinned }.thenByDescending { it.updatedAt })
    }

    val activeNote = notes.find { it.id == activeNoteId }

    fun saveCurrent() {
        val id = activeNoteId ?: return
        vm.updateNote(id) {
            copy(
                title = editTitle.ifBlank { "Без названия" },
                content = editContent,
                color = editColor,
                pinned = editPinned
            )
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text(if (activeNote != null) "Заметка" else "Заметки", color = ChronoTextPrimary) },
                navigationIcon = {
                    IconButton(onClick = {
                        if (activeNote != null) {
                            saveCurrent()
                            activeNoteId = null
                        } else onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад", tint = ChronoTextPrimary)
                    }
                },
                actions = {
                    if (activeNote == null) {
                        IconButton(onClick = {
                            val newNote = vm.createNote()
                            activeNoteId = newNote.id
                            editTitle = ""
                            editContent = ""
                            editColor = null
                            editPinned = false
                        }) {
                            Icon(Icons.Default.Add, "Новая", tint = Violet400)
                        }
                    } else {
                        Row {
                            IconButton(onClick = {
                                editPinned = !editPinned
                                vm.togglePinNote(activeNoteId!!)
                            }) {
                                Icon(Icons.Default.PushPin, "Закрепить",
                                    tint = if (editPinned) Amber500 else ChronoTextMuted)
                            }
                            IconButton(onClick = {
                                vm.deleteNote(activeNoteId!!)
                                activeNoteId = null
                            }) {
                                Icon(Icons.Default.Delete, "Удалить", tint = Rose400)
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        if (activeNote != null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .chronoBackground()
                    .padding(padding)
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                OutlinedTextField(
                    value = editTitle,
                    onValueChange = { editTitle = it },
                    placeholder = { Text("Заголовок", color = ChronoTextMuted) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true,
                    textStyle = MaterialTheme.typography.titleLarge.copy(color = ChronoTextPrimary),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Violet400.copy(alpha = 0.3f),
                        unfocusedBorderColor = Color.Transparent,
                        cursorColor = Violet400
                    )
                )

                Row(modifier = Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    NOTE_COLORS.forEach { (color, _) ->
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(if (color == null) ChronoSurface else parseColor(color))
                                .border(
                                    width = if (editColor == color) 2.dp else 1.dp,
                                    color = if (editColor == color) Violet400 else ChronoBorder,
                                    shape = CircleShape
                                )
                                .clickable { editColor = color }
                        )
                    }
                }

                Spacer(Modifier.height(4.dp))

                OutlinedTextField(
                    value = editContent,
                    onValueChange = { editContent = it },
                    placeholder = { Text("Начните писать...", color = ChronoTextMuted) },
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    shape = RoundedCornerShape(14.dp),
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = ChronoTextPrimary),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = Violet400.copy(alpha = 0.3f),
                        unfocusedBorderColor = Color.Transparent,
                        cursorColor = Violet400
                    )
                )
            }
        } else {
            if (sortedNotes.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize().chronoBackground().padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.StickyNote2, null, tint = ChronoTextMuted, modifier = Modifier.size(48.dp))
                        Spacer(Modifier.height(12.dp))
                        Text("Нет заметок", color = ChronoTextSecondary)
                        Text("Нажмите + чтобы создать", style = MaterialTheme.typography.bodySmall, color = ChronoTextMuted)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().chronoBackground().padding(padding),
                    contentPadding = PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(sortedNotes, key = { it.id }) { note ->
                        val noteColor = note.color?.let { parseColor(it) }
                        GlassCard(
                            modifier = Modifier
                                .clickable {
                                    activeNoteId = note.id
                                    editTitle = note.title
                                    editContent = note.content
                                    editColor = note.color
                                    editPinned = note.pinned
                                }
                                .then(
                                    if (noteColor != null) Modifier.border(1.dp, noteColor.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
                                    else Modifier
                                )
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (note.pinned) {
                                    Icon(Icons.Default.PushPin, null, tint = Amber500, modifier = Modifier.size(14.dp))
                                    Spacer(Modifier.width(4.dp))
                                }
                                if (noteColor != null) {
                                    Box(Modifier.size(8.dp).clip(CircleShape).background(noteColor))
                                    Spacer(Modifier.width(6.dp))
                                }
                                Text(
                                    note.title.ifBlank { "Без названия" },
                                    style = MaterialTheme.typography.titleMedium,
                                    color = ChronoTextPrimary,
                                    modifier = Modifier.weight(1f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                IconButton(
                                    onClick = { vm.deleteNote(note.id) },
                                    modifier = Modifier.size(24.dp)
                                ) {
                                    Icon(Icons.Default.Close, "Удалить", tint = ChronoTextMuted, modifier = Modifier.size(14.dp))
                                }
                            }
                            if (note.content.isNotBlank()) {
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    note.content.take(120),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = ChronoTextMuted,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun parseColor(hex: String): Color {
    return try { Color(android.graphics.Color.parseColor(hex)) } catch (_: Exception) { ChronoMuted }
}
