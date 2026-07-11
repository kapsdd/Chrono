package com.chrono.app.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.chrono.app.R

class NotesWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, am: AppWidgetManager, ids: IntArray) {
        for (id in ids) updateWidget(context, am, id)
    }

    companion object {
        fun updateAll(context: Context) {
            val am = AppWidgetManager.getInstance(context)
            val ids = am.getAppWidgetIds(
                android.content.ComponentName(context, NotesWidgetProvider::class.java)
            )
            for (id in ids) updateWidget(context, am, id)
        }

        private fun updateWidget(context: Context, am: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_notes)
            val intent = Intent(context, NotesWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_list, intent)
            views.setTextViewText(R.id.widget_title, "Заметки")
            views.setEmptyView(R.id.widget_list, R.id.widget_empty)
            am.updateAppWidget(widgetId, views)
            am.notifyAppWidgetViewDataChanged(widgetId, R.id.widget_list)
        }
    }
}
