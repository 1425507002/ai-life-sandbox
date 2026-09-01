param(
  [ValidateSet('status', 'start', 'open-url', 'screenshot', 'tap', 'back', 'home')]
  [string]$Action = 'status',
  [string]$Url,
  [int]$X,
  [int]$Y,
  [string]$Path = "$env:TEMP\mumu-screen.png",
  [string]$Serial = '127.0.0.1:16384'
)

$ErrorActionPreference = 'Stop'
$adb = 'F:\MuMuPlayer\nx_main\adb.exe'
$manager = 'F:\MuMuPlayer\nx_main\MuMuManager.exe'

if (-not (Test-Path $adb)) { throw "MuMu ADB not found: $adb" }
if (-not (Test-Path $manager)) { throw "MuMuManager not found: $manager" }

function Invoke-MuMuAdb {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  & $adb @Arguments
  if ($LASTEXITCODE -ne 0) { throw "ADB failed with exit code $LASTEXITCODE" }
}

function Wait-Device {
  $deadline = (Get-Date).AddSeconds(30)
  do {
    $lines = & $adb devices
    if ($lines -match [regex]::Escape("$Serial`tdevice")) { return }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "MuMu device did not become ready: $Serial"
}

switch ($Action) {
  'status' {
    & $manager info --vmindex 0
    & $adb devices -l
  }
  'start' {
    & $manager control --vmindex 0 launch
    Wait-Device
    & $manager info --vmindex 0
    & $adb devices -l
  }
  'open-url' {
    if ($Url -notmatch '^https?://') { throw 'Url must start with http:// or https://' }
    Wait-Device
    Invoke-MuMuAdb @('-s', $Serial, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', $Url)
  }
  'screenshot' {
    Wait-Device
    $resolved = [System.IO.Path]::GetFullPath($Path)
    $parent = Split-Path -Parent $resolved
    if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $adb
    $psi.Arguments = "-s $Serial exec-out screencap -p"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.CreateNoWindow = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $psi
    [void]$process.Start()
    $stream = [System.IO.MemoryStream]::new()
    $process.StandardOutput.BaseStream.CopyTo($stream)
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) { throw "ADB screenshot failed with exit code $($process.ExitCode)" }
    [System.IO.File]::WriteAllBytes($resolved, $stream.ToArray())
    Write-Output "Screenshot: $resolved"
  }
  'tap' {
    if ($X -lt 0 -or $Y -lt 0) { throw 'tap requires non-negative -X and -Y' }
    Wait-Device
    Invoke-MuMuAdb @('-s', $Serial, 'shell', 'input', 'tap', "$X", "$Y")
  }
  'back' {
    Wait-Device
    Invoke-MuMuAdb @('-s', $Serial, 'shell', 'input', 'keyevent', '4')
  }
  'home' {
    Wait-Device
    Invoke-MuMuAdb @('-s', $Serial, 'shell', 'input', 'keyevent', '3')
  }
}
