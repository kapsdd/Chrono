package com.chrono.app.data.repository

import com.chrono.app.data.model.ParsedInput
import com.chrono.app.data.model.PRIORITY_HIGH
import com.chrono.app.data.model.PRIORITY_LOW
import com.chrono.app.data.model.PRIORITY_MEDIUM
import com.chrono.app.data.model.PRIORITY_NONE

fun parseInput(raw: String): ParsedInput {
    val tokens = raw.trim().split("\\s+".toRegex())
    var title = ""
    var project: String? = null
    val tags = mutableListOf<String>()
    var priority = PRIORITY_NONE

    for (token in tokens) {
        when {
            token.startsWith("/") -> project = token.removePrefix("/")
            token.startsWith("#") -> {
                val tag = token.removePrefix("#")
                if (tag.isNotEmpty() && tag !in tags) tags.add(tag)
            }
            token.matches("!+".toRegex()) -> {
                priority = token.length.coerceAtMost(PRIORITY_HIGH)
            }
            else -> {
                if (title.isNotEmpty()) title += " "
                title += token
            }
        }
    }
    return ParsedInput(title, project, tags, priority)
}
