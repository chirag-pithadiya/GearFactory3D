# build.ps1 — Bundles src/ modules into standalone dist/bundle.js
$ErrorActionPreference = "Stop"

$distDir = Join-Path $PSScriptRoot "dist"
if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

$filesInOrder = @(
    "src/game-state.js",
    "src/levels.js",
    "src/audio.js",
    "src/gears.js",
    "src/motor.js",
    "src/bearings.js",
    "src/shafts.js",
    "src/lighting.js",
    "src/camera.js",
    "src/controls.js",
    "src/scene.js",
    "src/gearbox.js",
    "src/ui.js",
    "src/drag-drop.js",
    "src/tutorial.js",
    "src/main.js"
)

$bundleParts = [System.Collections.Generic.List[string]]::new()
$bundleParts.Add(@"
/**
 * Gear Factory 3D — Standalone Unified Production Bundle
 * Built for universal compatibility: works via http:// and local file:/// protocol.
 */
(function() {
  'use strict';

  const THREE = window.THREE;
  if (!THREE) {
    console.error('Three.js must be loaded before gear-factory bundle.');
    return;
  }
  const OrbitControls = THREE.OrbitControls;

"@)

foreach ($relPath in $filesInOrder) {
    $fullPath = Join-Path $PSScriptRoot $relPath
    if (-not (Test-Path $fullPath)) {
        Write-Error "Source file not found: $fullPath"
    }

    $lines = [System.IO.File]::ReadAllLines($fullPath, [System.Text.Encoding]::UTF8)
    $processedLines = [System.Collections.Generic.List[string]]::new()

    $inMultiImport = $false

    foreach ($line in $lines) {
        $trimmed = $line.Trim()

        # Handle multi-line import start: import { ...
        if ($trimmed -match '^import\s*\{' -and $trimmed -notmatch '\}\s*from') {
            $inMultiImport = $true
            continue
        }
        if ($inMultiImport) {
            if ($trimmed -match '\}\s*from') {
                $inMultiImport = $false
            }
            continue
        }

        # Single-line import
        if ($trimmed -match '^import\s+') {
            continue
        }

        # export { ... }
        if ($trimmed -match '^export\s*\{') {
            continue
        }

        # export default ...
        if ($trimmed -match '^export\s+default\s+') {
            $line = $line -replace 'export\s+default\s+', ''
        }

        # export const / let / var / function / class
        if ($trimmed -match '^export\s+(const|let|var|function|class)\s+') {
            $line = $line -replace 'export\s+(const|let|var|function|class)\s+', '$1 '
        }

        $processedLines.Add($line)
    }

    $bundleParts.Add("// --- Begin: $relPath ---`n" + ($processedLines -join "`n") + "`n// --- End: $relPath ---`n")
}

$bundleParts.Add(@"
})();
"@)

$outputBundle = Join-Path $distDir "bundle.js"
[System.IO.File]::WriteAllText($outputBundle, ($bundleParts -join "`n"), [System.Text.Encoding]::UTF8)
$bundleSize = (Get-Item $outputBundle).Length
Write-Host "Successfully built dist/bundle.js ($bundleSize bytes)" -ForegroundColor Green
