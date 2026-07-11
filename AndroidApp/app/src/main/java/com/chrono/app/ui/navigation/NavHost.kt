package com.chrono.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.chrono.app.ui.screens.*
import com.chrono.app.viewmodel.MainViewModel

sealed class Screen(val route: String) {
    data object Auth : Screen("auth")
    data object Home : Screen("home")
    data object Settings : Screen("settings")
    data object Notes : Screen("notes")
    data object ProjectDetail : Screen("project/{projectId}") {
        fun createRoute(projectId: String) = "project/$projectId"
    }
    data object TaskDetail : Screen("task/{taskId}") {
        fun createRoute(taskId: String) = "task/$taskId"
    }
    data object LobbyJoin : Screen("lobby")
    data object Members : Screen("members/{projectId}") {
        fun createRoute(projectId: String) = "members/$projectId"
    }
}

@Composable
fun ChronoNavHost() {
    val navController = rememberNavController()
    val vm: MainViewModel = viewModel()

    val startDest = if (vm.session.value != null) Screen.Home.route else Screen.Auth.route

    NavHost(navController = navController, startDestination = startDest) {
        composable(Screen.Auth.route) {
            AuthScreen(
                vm = vm,
                onAuthSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Home.route) {
            HomeScreen(
                vm = vm,
                onNavigateToSettings = { navController.navigate(Screen.Settings.route) },
                onNavigateToNotes = { navController.navigate(Screen.Notes.route) },
                onNavigateToProject = { navController.navigate(Screen.ProjectDetail.createRoute(it)) },
                onNavigateToTask = { navController.navigate(Screen.TaskDetail.createRoute(it)) },
                onNavigateToLobby = { navController.navigate(Screen.LobbyJoin.route) },
                onSignOut = {
                    vm.signOut()
                    navController.navigate(Screen.Auth.route) {
                        popUpTo(Screen.Home.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                vm = vm,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.Notes.route) {
            NotesScreen(
                vm = vm,
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.ProjectDetail.route,
            arguments = listOf(navArgument("projectId") { type = NavType.StringType })
        ) { backStack ->
            val projectId = backStack.arguments?.getString("projectId") ?: return@composable
            ProjectDetailScreen(
                vm = vm,
                projectId = projectId,
                onBack = { navController.popBackStack() },
                onNavigateToTask = { navController.navigate(Screen.TaskDetail.createRoute(it)) },
                onNavigateToMembers = { navController.navigate(Screen.Members.createRoute(projectId)) }
            )
        }

        composable(
            route = Screen.TaskDetail.route,
            arguments = listOf(navArgument("taskId") { type = NavType.StringType })
        ) { backStack ->
            val taskId = backStack.arguments?.getString("taskId") ?: return@composable
            TaskDetailScreen(
                vm = vm,
                taskId = taskId,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Screen.LobbyJoin.route) {
            LobbyJoinScreen(
                vm = vm,
                onBack = { navController.popBackStack() },
                onJoined = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.Members.route,
            arguments = listOf(navArgument("projectId") { type = NavType.StringType })
        ) { backStack ->
            val projectId = backStack.arguments?.getString("projectId") ?: return@composable
            MembersScreen(
                vm = vm,
                projectId = projectId,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
