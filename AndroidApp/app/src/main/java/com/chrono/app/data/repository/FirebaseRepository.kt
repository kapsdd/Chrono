package com.chrono.app.data.repository

import com.chrono.app.data.model.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.database.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.security.MessageDigest
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class FirebaseRepository {
    private val auth = FirebaseAuth.getInstance()
    private val db = FirebaseDatabase.getInstance().reference

    val currentUser get() = auth.currentUser

    fun authStateFlow(): Flow<Boolean> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { trySend(it.currentUser != null) }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    suspend fun signInWithGoogle(idToken: String): com.google.firebase.auth.FirebaseUser {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        return suspendCancellableCoroutine { cont ->
            auth.signInWithCredential(credential)
                .addOnSuccessListener { r -> r.user?.let { cont.resume(it) } ?: cont.resumeWithException(Exception("No user")) }
                .addOnFailureListener { cont.resumeWithException(it) }
        }
    }

    fun signOut() = auth.signOut()

    fun fetchAllFlow(): Flow<Snapshot> = callbackFlow {
        val uid = auth.currentUser?.uid ?: run {
            trySend(Snapshot(emptyList(), emptyList(), emptyList(), emptyList()))
            close()
            return@callbackFlow
        }

        var personalTasks = listOf<Task>()
        var personalProjects = listOf<Project>()
        var personalNotes = listOf<Note>()
        var friends = listOf<Friend>()
        var sharedTasksMap = mapOf<String, Task>()
        var sharedProjectsList = listOf<Project>()
        val extraListeners = mutableListOf<Pair<DatabaseReference, ValueEventListener>>()

        fun emit() {
            val allProjects = personalProjects + sharedProjectsList.filter { sp ->
                personalProjects.none { it.id == sp.id }
            }
            val allTasks = personalTasks + sharedTasksMap.values.filter { st ->
                personalTasks.none { it.id == st.id }
            }
            trySend(Snapshot(allProjects, allTasks, personalNotes, friends))
        }

        fun subscribeToShared(pid: String) {
            val metaRef = db.child("shared").child(pid).child("meta")
            val metaL = object : ValueEventListener {
                override fun onDataChange(snap: DataSnapshot) {
                    if (snap.exists()) {
                        val proj = dbToSharedProject(snap, pid)
                        sharedProjectsList = sharedProjectsList.filter { it.id != pid } + proj
                    }
                    emit()
                }
                override fun onCancelled(e: DatabaseError) {}
            }
            metaRef.addValueEventListener(metaL)
            extraListeners.add(metaRef to metaL)

            val stRef = db.child("shared").child(pid).child("tasks")
            val stL = object : ValueEventListener {
                override fun onDataChange(snap: DataSnapshot) {
                    val tasks = snap.children.mapNotNull { dbToTask(it) }
                    sharedTasksMap = sharedTasksMap.filter { it.value.projectId != pid } +
                            tasks.associateBy { it.id }
                    emit()
                }
                override fun onCancelled(e: DatabaseError) {}
            }
            stRef.addValueEventListener(stL)
            extraListeners.add(stRef to stL)
        }

        fun scanSharedProjects() {
            val joinCodesRef = db.child("joinCodes")
            val jcL = object : ValueEventListener {
                override fun onDataChange(jcSnap: DataSnapshot) {
                    // Clean old shared listeners
                    extraListeners.forEach { (ref, l) -> ref.removeEventListener(l) }
                    extraListeners.clear()
                    sharedTasksMap = emptyMap()
                    sharedProjectsList = emptyList()

                    val projectIds = mutableListOf<String>()
                    for (codeSnap in jcSnap.children) {
                        val pid = codeSnap.child("project_id").getValue(String::class.java)
                        if (pid != null) projectIds.add(pid)
                    }

                    if (projectIds.isEmpty()) { emit(); return }

                    var checked = 0
                    val sharedPids = mutableListOf<String>()

                    for (pid in projectIds) {
                        db.child("shared").child(pid).child("members").child(uid).get()
                            .addOnSuccessListener { memberSnap ->
                                if (memberSnap.exists()) sharedPids.add(pid)
                                checked++
                                if (checked == projectIds.size) {
                                    sharedPids.forEach { subscribeToShared(it) }
                                    emit()
                                }
                            }.addOnFailureListener {
                                checked++
                                if (checked == projectIds.size) {
                                    sharedPids.forEach { subscribeToShared(it) }
                                    emit()
                                }
                            }
                    }
                }
                override fun onCancelled(e: DatabaseError) { emit() }
            }
            joinCodesRef.addValueEventListener(jcL)
            extraListeners.add(joinCodesRef to jcL)
        }

        // 1. Personal tasks
        val tasksRef = db.child("users").child(uid).child("tasks")
        val tasksL = object : ValueEventListener {
            override fun onDataChange(s: DataSnapshot) {
                personalTasks = s.children.mapNotNull { dbToTask(it) }
                emit()
            }
            override fun onCancelled(e: DatabaseError) {}
        }
        tasksRef.addValueEventListener(tasksL)

        // 2. Personal projects + scan shared
        val projRef = db.child("users").child(uid).child("projects")
        val projL = object : ValueEventListener {
            override fun onDataChange(s: DataSnapshot) {
                personalProjects = s.children.mapNotNull { dbToProject(it) }
                scanSharedProjects()
            }
            override fun onCancelled(e: DatabaseError) {}
        }
        projRef.addValueEventListener(projL)

        // 3. Notes
        val notesRef = db.child("users").child(uid).child("notes")
        val notesL = object : ValueEventListener {
            override fun onDataChange(s: DataSnapshot) {
                personalNotes = s.children.mapNotNull { dbToNote(it) }
                emit()
            }
            override fun onCancelled(e: DatabaseError) {}
        }
        notesRef.addValueEventListener(notesL)

        // 4. Friends
        val frRef = db.child("users").child(uid).child("friends")
        val frL = object : ValueEventListener {
            override fun onDataChange(s: DataSnapshot) {
                friends = s.children.mapNotNull { dbToFriend(it) }
                emit()
            }
            override fun onCancelled(e: DatabaseError) {}
        }
        frRef.addValueEventListener(frL)

        awaitClose {
            tasksRef.removeEventListener(tasksL)
            projRef.removeEventListener(projL)
            notesRef.removeEventListener(notesL)
            frRef.removeEventListener(frL)
            extraListeners.forEach { (ref, l) -> ref.removeEventListener(l) }
        }
    }

    suspend fun upsertTask(task: Task, uid: String) {
        val row = taskToDB(task, uid)
        val updates = mutableMapOf<String, Any>("users/$uid/tasks/${task.id}" to row)
        if (task.projectId != null) updates["shared/${task.projectId}/tasks/${task.id}"] = row
        db.updateChildren(updates)
    }

    suspend fun upsertTasks(tasks: List<Task>, uid: String) {
        if (tasks.isEmpty()) return
        val updates = mutableMapOf<String, Any>()
        for (t in tasks) {
            val row = taskToDB(t, uid)
            updates["users/$uid/tasks/${t.id}"] = row
            if (t.projectId != null) updates["shared/${t.projectId}/tasks/${t.id}"] = row
        }
        db.updateChildren(updates)
    }

    suspend fun deleteTasks(ids: List<String>, uid: String, taskProjectIds: Map<String, String?>) {
        val updates = mutableMapOf<String, Any?>()
        for (id in ids) {
            updates["users/$uid/tasks/$id"] = null
            taskProjectIds[id]?.let { updates["shared/$it/tasks/$id"] = null }
        }
        db.updateChildren(updates)
    }

    suspend fun upsertProject(project: Project, uid: String) {
        db.child("users").child(uid).child("projects").child(project.id)
            .setValue(projectToDB(project, uid))
        if (project.published && project.joinCode != null) {
            db.child("shared").child(project.id).child("meta")
                .updateChildren(mapOf("name" to project.name, "color" to (project.color ?: "")))
        }
    }

    suspend fun deleteProject(projectId: String, uid: String) {
        db.updateChildren(mapOf<String, Any?>(
            "users/$uid/projects/$projectId" to null,
            "shared/$projectId" to null
        ))
        val codesSnap = db.child("joinCodes").get().await()
        for (cs in codesSnap.children) {
            if (cs.child("project_id").getValue(String::class.java) == projectId)
                db.child("joinCodes").child(cs.key!!).removeValue()
        }
    }

    suspend fun upsertFriend(friend: Friend, uid: String) {
        db.child("users").child(uid).child("friends").child(friend.id).setValue(friendToDB(friend))
    }

    suspend fun deleteFriend(friendId: String, uid: String) {
        db.child("users").child(uid).child("friends").child(friendId).removeValue()
    }

    suspend fun upsertNote(note: Note, uid: String) {
        db.child("users").child(uid).child("notes").child(note.id).setValue(noteToDB(note))
    }

    suspend fun deleteNote(noteId: String, uid: String) {
        db.child("users").child(uid).child("notes").child(noteId).removeValue()
    }

    suspend fun publishProject(projectId: String, code: String, password: String, project: Project, uid: String) {
        val hash = sha256(password)
        db.child("joinCodes").child(code).setValue(mapOf(
            "project_id" to projectId, "password_hash" to hash, "owner_id" to uid
        ))
        db.child("shared").child(projectId).child("meta").setValue(mapOf(
            "name" to project.name, "color" to (project.color ?: ""),
            "owner_id" to uid, "shared" to true,
            "view" to (project.view?.name?.lowercase() ?: "list"),
            "created_at" to project.createdAt
        ))
        db.child("shared").child(projectId).child("members").child(uid).setValue(mapOf(
            "role" to "owner", "name" to "Владелец",
            "avatar" to null, "joined_at" to System.currentTimeMillis().toString()
        ))
        db.child("users").child(uid).child("projects").child(projectId)
            .updateChildren(mapOf("published" to true, "join_code" to code, "shared" to true))
    }

    suspend fun unpublishProject(projectId: String) {
        val codesSnap = db.child("joinCodes").get().await()
        for (cs in codesSnap.children) {
            if (cs.child("project_id").getValue(String::class.java) == projectId)
                db.child("joinCodes").child(cs.key!!).removeValue()
        }
        db.child("shared").child(projectId).removeValue()
    }

    suspend fun joinProject(code: String, password: String, uid: String, name: String?, avatar: String?): String {
        val cleanCode = code.trim().uppercase()
        val codeSnap = db.child("joinCodes").child(cleanCode).get().await()
        if (!codeSnap.exists()) throw Exception("Код не найден")
        val projectId = codeSnap.child("project_id").getValue(String::class.java) ?: throw Exception("Код не найден")
        val storedHash = codeSnap.child("password_hash").getValue(String::class.java)
        if (storedHash != null && storedHash != sha256(password)) throw Exception("Неверный пароль")

        db.child("shared").child(projectId).child("members").child(uid).setValue(mapOf(
            "role" to "editor", "name" to (name ?: "Участник"),
            "avatar" to avatar, "joined_at" to System.currentTimeMillis().toString()
        ))

        return projectId
    }

    suspend fun leaveProject(projectId: String, uid: String) {
        db.child("shared").child(projectId).child("members").child(uid).removeValue()
        db.child("users").child(uid).child("projects").child(projectId).removeValue()
    }

    companion object {
        suspend fun <T> com.google.android.gms.tasks.Task<T>.await(): T =
            suspendCancellableCoroutine { cont ->
                addOnSuccessListener { cont.resume(it) }
                addOnFailureListener { cont.resumeWithException(it) }
            }
    }
}

data class Snapshot(val projects: List<Project>, val tasks: List<Task>, val notes: List<Note>, val friends: List<Friend>)

private fun sha256(input: String): String {
    val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
    return bytes.joinToString("") { "%02x".format(it) }
}

private fun taskToDB(t: Task, ownerId: String) = mapOf(
    "id" to t.id, "owner_id" to ownerId, "title" to t.title,
    "is_completed" to t.isCompleted, "priority" to t.priority,
    "parent_id" to t.parentId, "project_id" to t.projectId,
    "tags" to t.tags, "order" to t.order, "due" to t.due,
    "collapsed" to t.collapsed, "time_spent" to t.timeSpent,
    "note" to t.note.ifBlank { null },
    "recurrence" to t.recurrence?.name?.lowercase(),
    "streak" to t.streak, "last_completed_at" to t.lastCompletedAt,
    "created_at" to t.createdAt
)

private fun projectToDB(p: Project, ownerId: String) = mapOf(
    "id" to p.id, "owner_id" to (p.ownerId ?: ownerId), "name" to p.name,
    "share_id" to p.shareId, "color" to p.color, "shared" to p.shared,
    "view" to (p.view?.name?.lowercase() ?: "list"),
    "published" to p.published, "join_code" to p.joinCode,
    "created_at" to p.createdAt
)

private fun friendToDB(f: Friend) = mapOf(
    "id" to f.id, "name" to f.name, "avatar" to f.avatar, "added_at" to f.addedAt
)

private fun dbToTask(s: DataSnapshot): Task? {
    val id = s.child("id").getValue(String::class.java) ?: s.key ?: return null
    return Task(
        id = id, title = s.child("title").getValue(String::class.java) ?: "",
        isCompleted = s.child("is_completed").getValue(Boolean::class.java) ?: false,
        priority = (s.child("priority").getValue(Long::class.java) ?: 0).toInt(),
        parentId = s.child("parent_id").getValue(String::class.java),
        projectId = s.child("project_id").getValue(String::class.java),
        tags = s.child("tags").children.mapNotNull { it.getValue(String::class.java) },
        note = s.child("note").getValue(String::class.java) ?: "",
        order = s.child("order").getValue(Double::class.java) ?: 0.0,
        due = s.child("due").getValue(String::class.java),
        collapsed = s.child("collapsed").getValue(Boolean::class.java) ?: false,
        timeSpent = s.child("time_spent").getValue(Long::class.java) ?: 0,
        recurrence = s.child("recurrence").getValue(String::class.java)
            ?.let { runCatching { Recurrence.valueOf(it.uppercase()) }.getOrNull() },
        streak = (s.child("streak").getValue(Long::class.java) ?: 0).toInt(),
        lastCompletedAt = s.child("last_completed_at").getValue(String::class.java),
        createdAt = s.child("created_at").getValue(String::class.java) ?: ""
    )
}

private fun dbToProject(s: DataSnapshot): Project? {
    val id = s.child("id").getValue(String::class.java) ?: s.key ?: return null
    return Project(
        id = id, ownerId = s.child("owner_id").getValue(String::class.java),
        name = s.child("name").getValue(String::class.java) ?: "",
        shareId = s.child("share_id").getValue(String::class.java) ?: "",
        color = s.child("color").getValue(String::class.java) ?: "#a78bfa",
        shared = s.child("shared").getValue(Boolean::class.java) ?: false,
        view = s.child("view").getValue(String::class.java)
            ?.let { runCatching { ProjectView.valueOf(it.uppercase()) }.getOrNull() } ?: ProjectView.LIST,
        published = s.child("published").getValue(Boolean::class.java) ?: false,
        joinCode = s.child("join_code").getValue(String::class.java),
        createdAt = s.child("created_at").getValue(String::class.java) ?: ""
    )
}

private fun dbToSharedProject(s: DataSnapshot, pid: String) = Project(
    id = pid, ownerId = s.child("owner_id").getValue(String::class.java),
    name = s.child("name").getValue(String::class.java) ?: "",
    shareId = "", color = s.child("color").getValue(String::class.java) ?: "#a78bfa",
    shared = true,
    view = s.child("view").getValue(String::class.java)
        ?.let { runCatching { ProjectView.valueOf(it.uppercase()) }.getOrNull() } ?: ProjectView.LIST,
    published = true, createdAt = s.child("created_at").getValue(String::class.java) ?: ""
)

private fun dbToFriend(s: DataSnapshot): Friend? {
    val id = s.child("id").getValue(String::class.java) ?: s.key ?: return null
    return Friend(
        id = id, name = s.child("name").getValue(String::class.java) ?: "",
        avatar = s.child("avatar").getValue(String::class.java),
        addedAt = s.child("added_at").getValue(String::class.java) ?: ""
    )
}

private fun noteToDB(n: Note) = mapOf(
    "id" to n.id, "title" to n.title, "content" to n.content,
    "pinned" to n.pinned, "color" to n.color,
    "created_at" to n.createdAt, "updated_at" to n.updatedAt
)

private fun dbToNote(s: DataSnapshot): Note? {
    val id = s.child("id").getValue(String::class.java) ?: s.key ?: return null
    return Note(
        id = id,
        title = s.child("title").getValue(String::class.java) ?: "",
        content = s.child("content").getValue(String::class.java) ?: "",
        pinned = s.child("pinned").getValue(Boolean::class.java) ?: false,
        color = s.child("color").getValue(String::class.java),
        createdAt = s.child("created_at").getValue(String::class.java) ?: "",
        updatedAt = s.child("updated_at").getValue(String::class.java) ?: ""
    )
}
