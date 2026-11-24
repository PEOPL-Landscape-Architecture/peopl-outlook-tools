@echo off
rem Launcher Edge runs for the "com.peopl.files" native messaging host.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0peopl_files_host.ps1"
