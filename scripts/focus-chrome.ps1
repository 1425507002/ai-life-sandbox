param(
  [Parameter(Mandatory = $true)]
  [string]$Title,
  [int]$DelayMilliseconds = 0
)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WindowFocus {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr processId);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int processId);
  [DllImport("user32.dll")] public static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
}
'@

if ($DelayMilliseconds -gt 0) {
  Start-Sleep -Milliseconds $DelayMilliseconds
}

$window = Get-Process chrome -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -like "*$Title*" } |
  Select-Object -First 1

if (-not $window) {
  Write-Error "Chrome window containing title '$Title' was not found."
  exit 1
}

[WindowFocus]::AllowSetForegroundWindow(-1) | Out-Null
# Press/release Alt to satisfy Windows' foreground-activation rule.
[WindowFocus]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
[WindowFocus]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
$foreground = [WindowFocus]::GetForegroundWindow()
$currentThread = [WindowFocus]::GetCurrentThreadId()
$foregroundThread = [WindowFocus]::GetWindowThreadProcessId($foreground, [IntPtr]::Zero)
$targetThread = [WindowFocus]::GetWindowThreadProcessId($window.MainWindowHandle, [IntPtr]::Zero)
if ($foregroundThread -ne 0) { [WindowFocus]::AttachThreadInput($currentThread, $foregroundThread, $true) | Out-Null }
if ($targetThread -ne 0) { [WindowFocus]::AttachThreadInput($currentThread, $targetThread, $true) | Out-Null }
[WindowFocus]::ShowWindowAsync($window.MainWindowHandle, 9) | Out-Null
[WindowFocus]::BringWindowToTop($window.MainWindowHandle) | Out-Null
[WindowFocus]::SetForegroundWindow($window.MainWindowHandle) | Out-Null
[WindowFocus]::SwitchToThisWindow($window.MainWindowHandle, $true)
if ($targetThread -ne 0) { [WindowFocus]::AttachThreadInput($currentThread, $targetThread, $false) | Out-Null }
if ($foregroundThread -ne 0) { [WindowFocus]::AttachThreadInput($currentThread, $foregroundThread, $false) | Out-Null }
Write-Output ("Focused Chrome window: PID={0}, HWND={1}, TITLE={2}" -f $window.Id, $window.MainWindowHandle, $window.MainWindowTitle)
