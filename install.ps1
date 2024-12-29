<#
.SYNOPSIS
    A simple "no-brainer" PowerShell script to install gpt-files on Windows.

.DESCRIPTION
    1. Auto-detects Admin vs Non-Admin mode.
    2. Downloads the binary from a GitHub release URL.
    3. Installs to a suitable directory (Program Files or LocalAppData).
    4. Ensures that directory is on the PATH so you can invoke the binary anywhere.

#>

# GitHub release asset URL
$BinaryUrl = "https://github.com/Positive-LLC/gpt-files/releases/latest/download/gpt-files-x86_64-windows.exe"
$BinaryName = "gpt-files.exe"

Write-Host "`n=== GPT-FILES INSTALLER ==="
Write-Host "Downloading and installing from: $BinaryUrl"
Write-Host ""

# Detect if running as Administrator
function Is-Admin {
    $currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object System.Security.Principal.WindowsPrincipal($currentIdentity)
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltinRole]::Administrator)
}

$isAdmin = Is-Admin

# Choose install path based on Admin or not
if ($isAdmin) {
    $installPath = "C:\Program Files\Positive\gpt-files"
    $pathTarget = [System.EnvironmentVariableTarget]::Machine  # system PATH
    Write-Host "Running as Admin. Will install system-wide to: $installPath"
} else {
    $localAppData = $env:LOCALAPPDATA
    $installPath = Join-Path $localAppData "Positive\gpt-files"
    $pathTarget = [System.EnvironmentVariableTarget]::User     # user-specific PATH
    Write-Host "NOT running as Admin. Will install to user folder: $installPath"
}

Write-Host ""

# Create install directory if needed
if (!(Test-Path $installPath)) {
    Write-Host "Creating directory: $installPath"
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null
} else {
    Write-Host "Install directory already exists: $installPath"
}

# Download the binary
$outputFile = Join-Path $installPath $BinaryName
Write-Host "Downloading $BinaryName → $outputFile ..."
try {
    Invoke-WebRequest -Uri $BinaryUrl -OutFile $outputFile -UseBasicParsing
    Write-Host "Download complete."
} catch {
    Write-Error "Failed to download $BinaryUrl: $($_.Exception.Message)"
    exit 1
}

# Optionally set permissions (on Windows typically not needed, but just in case)
try {
    icacls $outputFile /grant "Users:(RX)" | Out-Null
} catch {
    Write-Warning "Could not set file permissions. Continuing anyway."
}

# Update PATH if necessary
Write-Host "`nChecking if $installPath is in the PATH..."
$oldPath = [System.Environment]::GetEnvironmentVariable("Path", $pathTarget)

if ($oldPath -notmatch [Regex]::Escape($installPath)) {
    Write-Host "$installPath is not in PATH. Adding it now..."
    # Ensure we don't double up the semicolon
    $newPath = $oldPath.TrimEnd(';') + ";" + $installPath
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, $pathTarget)
    Write-Host "Successfully added $installPath to PATH."
    Write-Host "You'll need to open a new terminal window for changes to take effect."
} else {
    Write-Host "$installPath is already in PATH. No changes made."
}

Write-Host ""
Write-Host "==============================="
Write-Host " GPT-FILES INSTALLATION DONE! "
Write-Host "==============================="
Write-Host "You can now run 'gpt-files' in a new terminal session."
Write-Host ""
