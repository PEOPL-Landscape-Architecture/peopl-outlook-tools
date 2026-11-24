# PEOPL Email Templates - native messaging host "com.peopl.files"
# Lets the extension (and only it: see allowed_origins in com.peopl.files.json)
#   pick : show the Windows "Open" dialog and return full file paths
#   stat : check that paths exist and return their name / size
#   read : return a slice of a file as base64 (the extension reads in chunks,
#          because one host->browser message is capped at 1 MB)
# Protocol: Chromium native messaging over stdin/stdout, each message is a
# 4-byte little-endian length followed by UTF-8 JSON. Runs until stdin closes.
# Windows PowerShell 5.1 (STA by default, which the dialog needs).

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$stdin  = [Console]::OpenStandardInput()
$stdout = [Console]::OpenStandardOutput()
$utf8   = New-Object System.Text.UTF8Encoding($false)
$ChunkMax = 600KB   # base64 grows 4/3 -> ~800 KB per reply, under the 1 MB cap

function Read-Exact([int]$n) {
    $buf = New-Object byte[] $n; $got = 0
    while ($got -lt $n) {
        $r = $stdin.Read($buf, $got, $n - $got)
        if ($r -le 0) { return $null }
        $got += $r
    }
    return ,$buf
}

function Send-Message($obj) {
    $json  = ConvertTo-Json $obj -Depth 6 -Compress
    $bytes = $utf8.GetBytes($json)
    $stdout.Write([BitConverter]::GetBytes([int]$bytes.Length), 0, 4)
    $stdout.Write($bytes, 0, $bytes.Length)
    $stdout.Flush()
}

function Expand-PathText([string]$p) {
    $p = $p.Trim().Trim('"')
    return [Environment]::ExpandEnvironmentVariables($p)
}

function Invoke-Pick($msg) {
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = 'Choose attachment(s)'
    $dlg.Multiselect = $true
    $dlg.Filter = 'All files (*.*)|*.*'
    if ($msg.initialDir) {
        $d = Expand-PathText $msg.initialDir
        if (Test-Path -LiteralPath $d -PathType Leaf) { $d = Split-Path -LiteralPath $d -Parent }
        if (Test-Path -LiteralPath $d -PathType Container) { $dlg.InitialDirectory = $d }
    }
    # An invisible top-most owner so the dialog opens in front of Edge.
    $owner = New-Object System.Windows.Forms.Form
    $owner.TopMost = $true; $owner.ShowInTaskbar = $false
    $owner.StartPosition = 'CenterScreen'; $owner.Size = New-Object System.Drawing.Size(1,1)
    $owner.Opacity = 0
    $owner.Show(); $owner.Activate()
    try {
        $res = $dlg.ShowDialog($owner)
        if ($res -eq [System.Windows.Forms.DialogResult]::OK) { return @{ ok = $true; paths = @($dlg.FileNames) } }
        return @{ ok = $true; paths = @() }
    } finally { $owner.Close(); $owner.Dispose(); $dlg.Dispose() }
}

function Invoke-Stat($msg) {
    $out = @()
    foreach ($raw in @($msg.paths)) {
        $p = Expand-PathText ([string]$raw)
        if ($p -and (Test-Path -LiteralPath $p -PathType Leaf)) {
            $fi = Get-Item -LiteralPath $p
            $out += @{ path = [string]$raw; exists = $true; name = $fi.Name; size = $fi.Length }
        } else {
            $out += @{ path = [string]$raw; exists = $false; name = [IO.Path]::GetFileName($p); size = 0 }
        }
    }
    return @{ ok = $true; files = $out }
}

function Invoke-Read($msg) {
    $p = Expand-PathText ([string]$msg.path)
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { return @{ ok = $false; error = "File not found: $p" } }
    $offset = [long]$msg.offset
    $fs = [IO.File]::Open($p, 'Open', 'Read', 'ReadWrite')
    try {
        $size = $fs.Length
        $len = [int][Math]::Min([long]$ChunkMax, [Math]::Max(0, $size - $offset))
        $buf = New-Object byte[] $len
        [void]$fs.Seek($offset, 'Begin')
        $got = 0
        while ($got -lt $len) { $r = $fs.Read($buf, $got, $len - $got); if ($r -le 0) { break }; $got += $r }
        return @{ ok = $true; size = $size; offset = $offset; count = $got; data = [Convert]::ToBase64String($buf, 0, $got);
                  done = (($offset + $got) -ge $size); name = [IO.Path]::GetFileName($p) }
    } finally { $fs.Dispose() }
}

while ($true) {
    $hdr = Read-Exact 4
    if ($null -eq $hdr) { break }
    $len = [BitConverter]::ToInt32($hdr, 0)
    if ($len -le 0) { break }
    $body = Read-Exact $len
    if ($null -eq $body) { break }
    $reply = $null
    try {
        $msg = $utf8.GetString($body) | ConvertFrom-Json
        switch ([string]$msg.cmd) {
            'ping' { $reply = @{ ok = $true; version = '1.0' } }
            'pick' { $reply = Invoke-Pick $msg }
            'stat' { $reply = Invoke-Stat $msg }
            'read' { $reply = Invoke-Read $msg }
            default { $reply = @{ ok = $false; error = "Unknown command: $($msg.cmd)" } }
        }
        if ($null -ne $msg.id) { $reply.id = $msg.id }
    } catch {
        $reply = @{ ok = $false; error = $_.Exception.Message }
        if ($msg -and $null -ne $msg.id) { $reply.id = $msg.id }
    }
    Send-Message $reply
}
