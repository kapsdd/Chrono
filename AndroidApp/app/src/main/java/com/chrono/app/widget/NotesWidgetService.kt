package com.chrono.app.widget

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.chrono.app.R
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase

class NotesWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent) = NotesViewsFactory(applicationContext)
}

private data class WidgetNote(val title: String, val content: String, val color: String?)

class NotesViewsFactory(private val ctx: Context) : RemoteViewsService.RemoteViewsFactory {
    private var items = listOf<WidgetNote>()
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
        val notes = mutableListOf<WidgetNote>()

        db.child("users").child(uid).child("notes").get()
            .addOnSuccessListener { snap ->
                for (child in snap.children) {
                    val title = child.child("title").getValue(String::class.java) ?: "Без названия"
                    val content = child.child("content").getValue(String::class.java) ?: ""
                    val color = child.child("color").getValue(String::class.java)
                    notes.add(WidgetNote(title, content, color))
                }
                notes.sortWith(compareByDescending<WidgetNote> { it.color != null }.thenBy { it.title })
                latch.countDown()
            }
            .addOnFailureListener { latch.countDown() }

        latch.await(3, java.util.concurrent.TimeUnit.SECONDS)
        items = notes.take(6)
    }

    override fun getViewAt(pos: Int): RemoteViews {
        val item = items[pos]
        val views = RemoteViews(ctx.packageName, R.layout.widget_note_item)
        views.setTextViewText(R.id.note_title, item.title.ifBlank { "Без названия" })
        views.setTextViewText(R.id.note_preview, item.content.take(60))
        return views
    }
}
