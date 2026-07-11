package com.chrono.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.dp
import com.chrono.app.ui.theme.*

@Composable
fun SmartInput(
    onSubmit: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Новая задача... (/проект #тег !!!)"
) {
    var text by remember { mutableStateOf("") }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = ChronoSurface.copy(alpha = 0.6f)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Add,
                contentDescription = null,
                tint = Violet400,
                modifier = Modifier.size(20.dp)
            )
            Spacer(Modifier.width(8.dp))
            BasicTextField(
                value = text,
                onValueChange = { text = it },
                modifier = Modifier.weight(1f),
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = ChronoTextPrimary),
                singleLine = true,
                cursorBrush = SolidColor(Violet400),
                decorationBox = { inner ->
                    Box {
                        if (text.isEmpty()) {
                            Text(
                                placeholder,
                                style = MaterialTheme.typography.bodyLarge,
                                color = ChronoTextMuted
                            )
                        }
                        inner()
                    }
                }
            )
            if (text.isNotBlank()) {
                TextButton(
                    onClick = {
                        onSubmit(text.trim())
                        text = ""
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = Violet400)
                ) {
                    Text("Добавить", style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}
