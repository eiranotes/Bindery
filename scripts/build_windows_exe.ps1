param(
  [switch]$Standalone
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..
npm install

if ($Standalone) {
  npm run tauri:build:standalone
  Write-Host "Check apps/desktop/dist-standalone for the standalone executable."
} else {
  npm run tauri:build
  Write-Host "Check apps/desktop/src-tauri/target/release/bundle/nsis for setup executable."
}
