package com.chrono.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.chrono.app.R
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.*

class TasksWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        val widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0)
        return TaskViewsFactory(applicationContext, widgetId)
    }
}

class HabitsWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent) = HabitViewsFactory(applicationContext)
}

data class WidgetTask(val id: String, val title: String, val priority: Int, val due: String?, val streak: Int, val isHabit: Boolean)

class TaskViewsFactory(private val ctx: Context, private val widgetId: Int) : RemoteViewsService.RemoteViewsFactory {
    private var items = listOf<WidgetTask>()
    override fun onCreate() {}
    override fun onDestroy() { items = emptyList() }
    override fun getCount() = items.size
    override fun getItemId(pos: Int) = pos.toLong()
    override fun hasStableIds() = true
    override fun getLoadingView() = null
    override fun getViewTypeCount() = 1

    override fun onDataSetChanged() {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        val db = FirebaseDatabase.getInstance().reference
        val prefs = ctx.getSharedPreferences("widget_config", Context.MODE_PRIVATE)
        val filterProjectId = prefs.getString("project_$widgetId", null)
        val latch = java.util.concurrent.CountDownLatch(1)
        val tasks = mutableListOf<WidgetTask>()

        db.child("users").child(uid).child("tasks").get()
            .addOnSuccessListener { snap ->
                for (child in snap.children) {
                    val completed = child.child("is_completed").getValue(Boolean::class.java) ?: false
                    if (completed) continue
                    val id = child.child("id").getValue(String::class.java) ?: child.key ?: continue
                    val title = child.child("title").getValue(String::class.java) ?: continue
                    val priority = (child.child("priority").getValue(Long::class.java) ?: 0).toInt()
                    val due = child.child("due").getValue(String::class.java)
                    val rec = child.child("recurrence").getValue(String::class.java)
                    if (rec != null) continue
                    val projectId = child.child("project_id").getValue(String::class.java)
                    if (filterProjectId != null && projectId != filterProjectId) continue
                    tasks.add(WidgetTask(id, title, priority, due, 0, false))
                }
                tasks.sortByDescending { it.priority }
                latch.countDown()
            }
            .addOnFailureListener { latch.countDown() }

        latch.await(3, java.util.concurrent.TimeUnit.SECONDS)
        items = tasks.take(6)
    }

    override fun getViewAt(pos: Int): RemoteViews {
        val item = items[pos]
        val views = RemoteViews(ctx.packageName, R.layout.widget_task_item)
        views.setTextViewText(R.id.item_title, item.title)

        val meta = mutableListOf<String>()
        if (item.priority >= 2) meta.add("●")
        item.due?.let {
            try { meta.add("${it.substring(8,10)}.${it.substring(5,7)}") } catch (_: Exception) {}
        }
        views.setTextViewText(R.id.item_meta, meta.joinToString(" "))

        val completeIntent = Intent(ctx, WidgetActionReceiver::class.java).apply {
            action = "COMPLETE_TASK"
            putExtra("task_id", item.id)
            data = Uri.parse("chrono://complete/${item.id}")
        }
        views.setOnClickPendingIntent(R.id.item_check,
            PendingIntent.getBroadcast(ctx, item.id.hashCode(), completeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

        return views
    }
}

class HabitViewsFactory(private val ctx: Context) : RemoteViewsService.RemoteViewsFactory {
    private var items = listOf<WidgetTask>()
    override fun onCreate() {}
    override fun onDestroy() { items = emptyList() }
    override fun getCount() = items.size
    override fun getItemId(pos: Int) = pos.toLong()
    override fun hasStableIds() = true
    override fun getLoadingView() = null
    override fun getViewTypeCount() = 1

    override fun onDataSetChanged() {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        val db = FirebaseDatabase.getInstance().reference
        val latch = java.util.concurrent.CountDownLatch(1)
        val habits = mutableListOf<WidgetTask>()

        db.child("users").child(uid).child("tasks").get()
            .addOnSuccessListener { snap ->
                for (child in snap.children) {
                    val rec = child.child("recurrence").getValue(String::class.java) ?: continue
                    val completed = child.child("is_completed").getValue(Boolean::class.java) ?: false
                    if (completed) continue
                    val id = child.child("id").getValue(String::class.java) ?: child.key ?: continue
                    val title = child.child("title").getValue(String::class.java) ?: continue
                    val streak = (child.child("streak").getValue(Long::class.java) ?: 0).toInt()
                    habits.add(WidgetTask(id, title, 0, null, streak, true))
                }
                latch.countDown()
            }
            .addOnFailureListener { latch.countDown() }

        latch.await(3, java.util.concurrent.TimeUnit.SECONDS)
        items = habits.take(6)
    }

    override fun getViewAt(pos: Int): RemoteViews {
        val item = items[pos]
        val views = RemoteViews(ctx.packageName, R.layout.widget_task_item)
        views.setTextViewText(R.id.item_title, item.title)
        views.setTextViewText(R.id.item_meta, "🔥${item.streak}")

        val completeIntent = Intent(ctx, WidgetActionReceiver::class.java).apply {
            action = "COMPLETE_TASK"
            putExtra("task_id", item.id)
            data = Uri.parse("chrono://complete/${item.id}")
        }
        views.setOnClickPendingIntent(R.id.item_check,
            PendingIntent.getBroadcast(ctx, item.id.hashCode(), completeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))

        return views
    }
}
