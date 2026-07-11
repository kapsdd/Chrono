package com.chrono.app.widget

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.database.FirebaseDatabase
import java.text.SimpleDateFormat
import java.util.*

class WidgetActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "COMPLETE_TASK") return
        val taskId = intent.getStringExtra("task_id") ?: return
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        val db = FirebaseDatabase.getInstance().reference

        // First read the task to check if it's recurring
        db.child("users").child(uid).child("tasks").child(taskId).get()
            .addOnSuccessListener { snap ->
                val rec = snap.child("recurrence").getValue(String::class.java)
                val isCompleted = snap.child("is_completed").getValue(Boolean::class.java) ?: false

                if (rec != null && !isCompleted) {
                    // Recurring task - update streak and due date
                    val lastCompleted = snap.child("last_completed_at").getValue(String::class.java)
                    val streak = (snap.child("streak").getValue(Long::class.java) ?: 0).toInt()
                    val now = System.currentTimeMillis()
                    val periodMs = when (rec) {
                        "daily" -> 86_400_000L
                        "weekly" -> 7 * 86_400_000L
                        "monthly" -> 30 * 86_400_000L
                        else -> 86_400_000L
                    }
                    val lastTime = lastCompleted?.let {
                        try { SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).parse(it)?.time ?: 0L }
                        catch (_: Exception) { 0L }
                    } ?: 0L
                    val gap = now - lastTime
                    val newStreak = if (gap in 0..(periodMs * 1.5).toLong()) streak + 1 else 1
                    val due = snap.child("due").getValue(String::class.java)
                    val base = maxOf(now, due?.let {
                        try { SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).parse(it)?.time ?: now }
                        catch (_: Exception) { now }
                    } ?: now)
                    val newDue = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date(base + periodMs))
                    val newLastCompleted = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date(now))

                    val updates = mapOf(
                        "streak" to newStreak,
                        "last_completed_at" to newLastCompleted,
                        "due" to newDue
                    )
                    db.child("users").child(uid).child("tasks").child(taskId).updateChildren(updates)
                } else {
                    // Normal task - mark complete
                    db.child("users").child(uid).child("tasks").child(taskId)
                        .child("is_completed").setValue(true)
                }

                // Refresh widgets
                TasksWidgetProvider.updateAll(context)
                HabitsWidgetProvider.updateAll(context)
            }
    }
}
