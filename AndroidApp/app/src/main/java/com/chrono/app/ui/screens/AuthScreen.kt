package com.chrono.app.ui.screens

import android.app.Activity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chrono.app.R
import com.chrono.app.ui.theme.*
import com.chrono.app.viewmodel.MainViewModel
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException

@Composable
fun AuthScreen(
    vm: MainViewModel,
    onAuthSuccess: () -> Unit
) {
    val session by vm.session.collectAsState()
    val context = LocalContext.current
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(session) {
        if (session != null) onAuthSuccess()
    }

    val gso = remember {
        GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken("514930791311-hnhbeqsh5no5krgq0qk6jtaatsvgtm15.apps.googleusercontent.com")
            .requestEmail()
            .build()
    }

    val googleSignInClient = remember { GoogleSignIn.getClient(context, gso) }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        loading = false
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
            val account = task.getResult(ApiException::class.java)
            account.idToken?.let { vm.signInWithGoogle(it) }
                ?: run { error = "Не удалось получить токен" }
        } catch (e: ApiException) {
            error = "Ошибка авторизации: ${e.statusCode}"
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .chronoBackground()
            .systemBarsPadding()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                "CHRONO",
                style = MaterialTheme.typography.headlineLarge.copy(
                    fontSize = 42.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 6.sp
                ),
                color = ChronoTextPrimary
            )

            Spacer(Modifier.height(8.dp))
            Text(
                "Премиум менеджер задач",
                style = MaterialTheme.typography.bodyLarge,
                color = ChronoTextMuted
            )

            Spacer(Modifier.height(6.dp))
            Text(
                "GAIVS · IVLIVS · CAESAR",
                style = MaterialTheme.typography.labelSmall,
                color = Violet400.copy(alpha = 0.5f),
                letterSpacing = 3.sp
            )

            Spacer(Modifier.height(48.dp))

            Button(
                onClick = {
                    loading = true
                    error = null
                    googleSignInClient.signOut().addOnCompleteListener {
                        launcher.launch(googleSignInClient.signInIntent)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Violet500
                ),
                enabled = !loading
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        "Войти через Google",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }

            error?.let {
                Spacer(Modifier.height(12.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(24.dp))

            Text(
                "Veni, vidi, vici.\nПришёл, увидел, победил.",
                style = MaterialTheme.typography.bodySmall,
                color = ChronoTextMuted.copy(alpha = 0.5f),
                textAlign = TextAlign.Center
            )
        }
    }
}
