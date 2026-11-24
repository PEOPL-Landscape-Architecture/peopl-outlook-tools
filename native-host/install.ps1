# Registers the "com.peopl.files" native messaging host for Edge and Chrome
# (current user only, no admin). Run again after moving this folder or if the
# extension's ID changes (the ID of an unpacked extension follows its folder).
#   powershell -ExecutionPolicy Bypass -File install.ps1 [-ExtensionId <id>] [-Uninstall]
#
# Packaged-app trap (found 2026-11-24): a shell started inside an MSIX app (e.g.
# the Claude desktop app's terminal) has its HKCU writes silently redirected into
# that app's private registry, so Edge never sees them ("Specified native
# messaging host not found"). So the script always re-runs itself as a normal
# process (via WMI Win32_Process.Create, outside any package) to do the writes.
param(
    [string]$ExtensionId = 'ejljeppjlklbgklmfbcgnjnojdefmbci',
    [switch]$Uninstall,
    [string]$Log = ''
)
$ErrorActionPreference = 'Stop'
$name = 'com.peopl.files'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $here "$name.json"
$keys = @("HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$name",
          "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$name")

function Test-Packaged {
    Add-Type -Namespace PeoplNative -Name Pkg -MemberDefinition @'
[DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
public static extern int GetCurrentPackageFullName(ref int length, System.Text.StringBuilder name);
'@ -ErrorAction SilentlyContinue
    $len = 0
    $rc = [PeoplNative.Pkg]::GetCurrentPackageFullName([ref]$len, $null)
    return ($rc -ne 15700)   # 15700 = APPMODEL_ERROR_NO_PACKAGE
}

# Always do the writes from an outside process: the package check above can
# miss it (a child shell of the Claude app reported "no package" and was still
# virtualized), and re-launching from a normal shell costs nothing.
if (-not $Log) {
    if (Test-Packaged) { "This shell runs inside a packaged app; registering from a normal process instead." }
    $logFile = Join-Path $env:TEMP ("peopl-files-install-{0}.log" -f [guid]::NewGuid().ToString('N'))
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $cmd = '"{0}" -NoProfile -ExecutionPolicy Bypass -File "{1}" -ExtensionId {2} -Log "{3}"{4}' -f `
        $ps, $MyInvocation.MyCommand.Path, $ExtensionId, $logFile, $(if ($Uninstall) { ' -Uninstall' } else { '' })
    $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
    if ($r.ReturnValue -ne 0) { throw "Couldn't start the outside process (Win32_Process.Create returned $($r.ReturnValue))." }
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $logFile) { $t = Get-Content $logFile -Raw; if ($t -match 'DONE') { break } }
        Start-Sleep -Milliseconds 300
    }
    if (Test-Path $logFile) { Get-Content $logFile; Remove-Item $logFile -Force } else { "No result from the outside process." }
    return
}

function Out-Line($s) { $s; if ($Log) { Add-Content -LiteralPath $Log -Value $s } }

try {
    if ($Uninstall) {
        foreach ($k in $keys) { if (Test-Path $k) { Remove-Item $k -Force; Out-Line "Removed $k" } }
    } else {
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
            Out-Line "Registered $k -> $manifestPath"
        }
        Out-Line "Allowed extension: $ExtensionId"
    }
} catch { Out-Line "ERROR: $($_.Exception.Message)" }
Out-Line "DONE"
