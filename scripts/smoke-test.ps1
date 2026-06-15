[CmdletBinding()]
param(
  [string]$BrowserPath = "",
  [int]$VirtualTimeBudget = 30000,
  [int]$BrowserTimeoutMs = 90000
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$SmokePath = Resolve-Path (Join-Path $ProjectRoot "tests\smoke.html")
$SmokeUrl = ([System.Uri]$SmokePath.Path).AbsoluteUri

function Find-Browser {
  param([string]$RequestedPath)

  if ($RequestedPath) {
    if (Test-Path -LiteralPath $RequestedPath -PathType Leaf) {
      return $RequestedPath
    }
    throw "BrowserPath does not exist: $RequestedPath"
  }

  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LocalAppData\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
      return $candidate
    }
  }

  foreach ($commandName in @("chrome.exe", "msedge.exe")) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($command?.Source -and (Test-Path -LiteralPath $command.Source -PathType Leaf)) {
      return $command.Source
    }
  }

  throw "Chrome or Edge was not found. Pass -BrowserPath to a Chromium-based browser."
}

function Join-ProcessArguments {
  param([string[]]$Arguments)
  return ($Arguments | ForEach-Object {
    $value = [string]$_
    if ($value -match '[\s"]') {
      '"' + $value.Replace('"', '\"') + '"'
    } else {
      $value
    }
  }) -join " "
}

function Copy-DedupedProcessEnvironment {
  param([System.Diagnostics.ProcessStartInfo]$StartInfo)
  $useEnvironment = $null -ne $StartInfo.Environment
  if ($useEnvironment) { $StartInfo.Environment.Clear() }
  else { $StartInfo.EnvironmentVariables.Clear() }
  $seen = @{}
  $envs = [System.Environment]::GetEnvironmentVariables("Process")
  foreach ($key in $envs.Keys) {
    $name = [string]$key
    $canonical = $name.ToUpperInvariant()
    if ($seen.ContainsKey($canonical)) { continue }
    $seen[$canonical] = $true
    if ($useEnvironment) { $StartInfo.Environment[$name] = [string]$envs[$key] }
    else { $StartInfo.EnvironmentVariables[$name] = [string]$envs[$key] }
  }
}

function Invoke-BrowserDomDump {
  param(
    [string]$Browser,
    [string[]]$Arguments,
    [string]$StdoutPath,
    [string]$StderrPath,
    [int]$TimeoutMs
  )
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Browser
  $startInfo.Arguments = Join-ProcessArguments $Arguments
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true
  Copy-DedupedProcessEnvironment $startInfo
  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  if (-not $process.WaitForExit($TimeoutMs)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Browser timed out after ${TimeoutMs}ms"
  }
  [System.IO.File]::WriteAllText($StdoutPath, $stdoutTask.Result, [System.Text.UTF8Encoding]::new($false))
  [System.IO.File]::WriteAllText($StderrPath, $stderrTask.Result, [System.Text.UTF8Encoding]::new($false))
  return $process.ExitCode
}

$browser = Find-Browser $BrowserPath
$profileDir = Join-Path ([System.IO.Path]::GetTempPath()) ("narrative-canvas-smoke-" + [System.Guid]::NewGuid().ToString("N"))
$stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) ("narrative-canvas-smoke-out-" + [System.Guid]::NewGuid().ToString("N") + ".html")
$stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ("narrative-canvas-smoke-err-" + [System.Guid]::NewGuid().ToString("N") + ".log")
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

try {
  Write-Host "Smoke test URL: $SmokeUrl"
  Write-Host "Browser: $browser"

  $browserArgs = @(
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--no-sandbox",
    "--allow-file-access-from-files",
    "--user-data-dir=$profileDir",
    "--virtual-time-budget=$VirtualTimeBudget",
    "--dump-dom",
    $SmokeUrl
  )

  $exitCode = Invoke-BrowserDomDump -Browser $browser -Arguments $browserArgs -StdoutPath $stdoutPath -StderrPath $stderrPath -TimeoutMs $BrowserTimeoutMs
  $html = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -Raw -Encoding UTF8 -LiteralPath $stdoutPath } else { "" }
  $stderr = if (Test-Path -LiteralPath $stderrPath) { Get-Content -Raw -Encoding UTF8 -LiteralPath $stderrPath } else { "" }

  $match = [regex]::Match($html, '<pre id="smoke-report">([\s\S]*?)</pre>')
  if ($match.Success) {
    $report = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value.Trim())
    Write-Host $report
  } else {
    Write-Host $html
    if ($stderr) {
      Write-Host $stderr
    }
  }

  if ($exitCode -and $exitCode -ne 0) {
    throw "Browser exited with code $exitCode"
  }

  if ($html -notmatch 'data-smoke-status="pass"') {
    throw "Smoke tests failed"
  }

  Write-Host "Smoke tests passed"
} finally {
  Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
}
