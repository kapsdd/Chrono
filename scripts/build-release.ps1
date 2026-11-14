# Release build. Loads the gitignored .env into the process environment so the
# Google OAuth client secret is baked into the binary at compile time (see
# src-tauri/build.rs). The secret never enters git.
#
#   powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1 -Bundles nsis

param(
    [string]$Bundles = "nsis"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# --- toolchain (portable MinGW + rustup shims) -----------------------------
$mingw = Join-Path $env:LOCALAPPDATA "mingw64\bin"
$cargo = Join-Path $env:USERPROFILE ".cargo\bin"
$env:PATH = "$mingw;$cargo;$env:PATH"

# --- load .env -------------------------------------------------------------
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $i = $line.IndexOf("=")
            if ($i -gt 0) {
                $k = $line.Substring(0, $i).Trim()
                $v = $line.Substring($i + 1).Trim()
                if ($k -and -not [Environment]::GetEnvironmentVariable($k)) {
                    [Environment]::SetEnvironmentVariable($k, $v, "Process")
                }
            }
        }
    }
    Write-Host "loaded $envFile"
} else {
    Write-Warning "no .env found - the Google sign-in will not be baked in"
}

if (-not $env:GOOGLE_CLIENT_SECRET) {
    Write-Warning "GOOGLE_CLIENT_SECRET is empty - login will fail in this build"
}

# --- build -----------------------------------------------------------------
Set-Location $root
& npx tauri build --bundles $Bundles
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$out = Join-Path $root "src-tauri\target\release\bundle"
Write-Host ""
Write-Host "bundles in $out"
Get-ChildItem $out -Recurse -File | ForEach-Object {
    Write-Host ("  {0}  ({1:N2} MiB)" -f $_.FullName, ($_.Length / 1MB))
}
