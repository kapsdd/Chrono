package com.chrono.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.chrono.app.R
import com.chrono.app.data.model.Recurrence
import com.chrono.app.data.model.Task
import com.chrono.app.data.repository.FirebaseRepository
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.*
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

class TasksWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, am: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, am, id)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("widget_config", Context.MODE_PRIVATE)
        val editor = prefs.edit()
        for (id in appWidgetIds) editor.remove("project_$id")
        editor.apply()
    }

    companion object {
        fun updateAll(context: Context) {
            val am = AppWidgetManager.getInstance(context)
            val ids = am.getAppWidgetIds(
                android.content.ComponentName(context, TasksWidgetProvider::class.java)
            )
            for (id in ids) updateWidget(context, am, id)
        }

        private fun updateWidget(context: Context, am: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_tasks)
            val intent = Intent(context, TasksWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_list, intent)
            views.setTextViewText(R.id.widget_title, "Chrono — Задачи")
            views.setEmptyView(R.id.widget_list, R.id.widget_empty)
            am.updateAppWidget(widgetId, views)
            am.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list)
        }
    }
}

class HabitsWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, am: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, am, id)
    }

    companion object {
        fun updateAll(context: Context) {
            val am = AppWidgetManager.getInstance(context)
            val ids = am.getAppWidgetIds(
                android.content.ComponentName(context, HabitsWidgetProvider::class.java)
            )
            for (id in ids) updateWidget(context, am, id)
        }

        private fun updateWidget(context: Context, am: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_habits)
            val intent = Intent(context, HabitsWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_list, intent)
            views.setTextViewText(R.id.widget_title, "Chrono — Привычки")
            views.setEmptyView(R.id.widget_list, R.id.widget_empty)
            am.updateAppWidget(widgetId, views)
            am.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list)
        }
    }
}
