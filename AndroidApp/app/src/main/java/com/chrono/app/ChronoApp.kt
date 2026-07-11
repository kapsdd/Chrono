package com.chrono.app

import android.app.Application
import com.chrono.app.ui.theme.ThemeStore
import com.chrono.app.widget.WidgetRefreshWorker
import com.google.firebase.FirebaseApp

class ChronoApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
        ThemeStore.init(this)
        WidgetRefreshWorker.schedule(this)
    }
}
