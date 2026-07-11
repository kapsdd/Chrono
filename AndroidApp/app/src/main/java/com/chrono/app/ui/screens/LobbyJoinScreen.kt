package com.chrono.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.chrono.app.ui.components.GlassCard
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LobbyJoinScreen(
    vm: MainViewModel,
    onBack: () -> Unit,
    onJoined: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = { Text("Присоединиться", color = ChronoTextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Назад", tint = ChronoTextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .chronoBackground()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            GlassCard {
                Text(
                    "Введите код лобби",
                    style = MaterialTheme.typography.titleMedium,
                    color = ChronoTextPrimary
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "Попросите код у владельца проекта",
                    style = MaterialTheme.typography.bodySmall,
                    color = ChronoTextMuted
                )
            }

            OutlinedTextField(
                value = code,
                onValueChange = { code = it.uppercase() },
                label = { Text("Код (XXX-XXX)") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Violet400,
                    unfocusedBorderColor = ChronoBorder,
                    focusedLabelColor = Violet400,
                    cursorColor = Violet400
                )
            )

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Пароль (если есть)") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Violet400,
                    unfocusedBorderColor = ChronoBorder,
                    focusedLabelColor = Violet400,
                    cursorColor = Violet400
                )
            )

            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Ваше имя") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Violet400,
                    unfocusedBorderColor = ChronoBorder,
                    focusedLabelColor = Violet400,
                    cursorColor = Violet400
                )
            )

            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Button(
                onClick = {
                    if (code.isBlank()) {
                        error = "Введите код"
                        return@Button
                    }
                    scope.launch {
                        loading = true
                        error = null
                        val result = vm.joinLobby(code, password, name.ifBlank { null }, null)
                        loading = false
                        result.fold(
                            onSuccess = { onJoined() },
                            onFailure = { error = it.message ?: "Ошибка" }
                        )
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Violet500),
                enabled = !loading && code.isNotBlank()
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Присоединиться")
                }
            }
        }
    }
}
