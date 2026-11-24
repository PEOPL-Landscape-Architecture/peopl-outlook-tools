# Registers the "com.peopl.files" native messaging host for Edge and Chrome
# (current user only, no admin). Run again after moving this folder or if the
# extension's ID changes (the ID of an unpacked extension follows its folder).
#   powershell -ExecutionPolicy Bypass -File install.ps1 [-ExtensionId <id>] [-Uninstall]
param(
    [string]$ExtensionId = 'ejljeppjlklbgklmfbcgnjnojdefmbci',
    [switch]$Uninstall
)
$ErrorActionPreference = 'Stop'
$name = 'com.peopl.files'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $here "$name.json"
$keys = @("HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$name",
          "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$name")

if ($Uninstall) {
    foreach ($k in $keys) { if (Test-Path $k) { Remove-Item $k -Force; "Removed $k" } }
    return
}

$manifest = [ordered]@{
    name            = $name
    description     = 'PEOPL Email Templates - file picker and attachment reader'
    path            = (Join-Path $here 'peopl_files_host.bat')
    type            = 'stdio'
    allowed_origins = @("chrome-extension://$ExtensionId/")
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding ASCII
foreach ($k in $keys) {
    New-Item -Path $k -Force | Out-Null
    Set-Item -Path $k -Value $manifestPath
    "Registered $k -> $manifestPath"
}
"Allowed extension: $ExtensionId"
