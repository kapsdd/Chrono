package com.chrono.app.widget

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.chrono.app.ui.theme.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase

class WidgetConfigActivity : ComponentActivity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        widgetId = intent?.extras?.getInt(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            ?: AppWidgetManager.INVALID_APPWIDGET_ID

        setResult(RESULT_CANCELED)

        setContent {
            ChronoTheme {
                WidgetConfigScreen(
                    onSelect = { projectId, projectName ->
                        getSharedPreferences("widget_config", Context.MODE_PRIVATE).edit()
                            .putString("project_$widgetId", projectId)
                            .putString("project_name_$widgetId", projectName)
                            .apply()
                        TasksWidgetProvider.updateAll(this)
                        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
                        finish()
                    },
                    onCancel = { finish() }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WidgetConfigScreen(
    onSelect: (projectId: String?, projectName: String) -> Unit,
    onCancel: () -> Unit
) {
    var projects by remember { mutableStateOf(listOf<Triple<String, String, String>>()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        val uid = FirebaseAuth.getInstance().currentUser?.uid
        if (uid != null) {
            val db = FirebaseDatabase.getInstance().reference
            db.child("users").child(uid).child("projects").get()
                .addOnSuccessListener { snap ->
                    val list = mutableListOf<Triple<String, String, String>>()
                    for (child in snap.children) {
                        val id = child.child("id").getValue(String::class.java) ?: child.key ?: continue
                        val name = child.child("name").getValue(String::class.java) ?: continue
                        val color = child.child("color").getValue(String::class.java) ?: "#a78bfa"
                        list.add(Triple(id, name, color))
                    }
                    projects = list
                    loading = false
                }
                .addOnFailureListener { loading = false }
        } else {
            loading = false
        }
    }

    Scaffold(
        containerColor = ChronoBgFrom,
        topBar = {
            TopAppBar(
                title = { Text("Выберите проект", color = ChronoTextPrimary) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ChronoSurface)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(null, "Все задачи") },
                    colors = CardDefaults.cardColors(containerColor = ChronoSurface.copy(alpha = 0.7f)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier
                                .size(12.dp)
                                .clip(CircleShape)
                                .background(Violet400)
                        )
                        Spacer(Modifier.width(12.dp))
                        Text("Все задачи", style = MaterialTheme.typography.bodyLarge, color = ChronoTextPrimary)
                    }
                }
            }

            if (loading) {
                item {
                    Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = Violet400, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                    }
                }
            }

            items(projects) { (id, name, color) ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(id, name) },
                    colors = CardDefaults.cardColors(containerColor = ChronoSurface.copy(alpha = 0.7f)),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val c = try { Color(android.graphics.Color.parseColor(color)) } catch (_: Exception) { Violet400 }
                        Box(
                            Modifier
                                .size(12.dp)
                                .clip(CircleShape)
                                .background(c)
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(name, style = MaterialTheme.typography.bodyLarge, color = ChronoTextPrimary)
                    }
                }
            }
        }
    }
}
