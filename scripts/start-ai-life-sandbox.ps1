$ErrorActionPreference = 'Stop'

$repoPath = Split-Path -Parent $PSScriptRoot
$gameUrl = 'http://127.0.0.1:4174/'

function Write-Failure([string]$message) {
  Write-Host "`nStartup failed: $message" -ForegroundColor Red
  Write-Host 'Press any key to close this window.' -ForegroundColor Yellow
  [void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
  exit 1
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Failure 'pnpm was not found. Install Node.js, then run: npm install -g pnpm'
}

Set-Location -LiteralPath $repoPath

$listening = Get-NetTCPConnection -LocalPort 4174 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Write-Host 'Starting AI Life Sandbox dev server...' -ForegroundColor Cyan
  $command = "Set-Location -LiteralPath '$repoPath'; pnpm dev"
  Start-Process powershell.exe -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $command) | Out-Null
}

$ready = $false
foreach ($attempt in 1..30) {
  Start-Sleep -Seconds 1
  try {
    $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      $ready = $true
      break
    }
  } catch {
    # Vite may need a few seconds to start; keep polling.
  }
  Write-Host ('.' * $attempt) -NoNewline
}

if (-not $ready) {
  Write-Failure 'The dev server did not respond within 30 seconds. Check the pnpm dev window.'
}

Write-Host "`nGame is ready: $gameUrl" -ForegroundColor Green
Start-Process $gameUrl
Start-Sleep -Seconds 2
