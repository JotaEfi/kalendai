# ============================================================
# ci-local.ps1 - Replica exatamente o CI/CD do GitHub Actions
#
# Uso: .\scripts\ci-local.ps1
#      .\scripts\ci-local.ps1 -SkipDocker   (pula docker builds)
#      .\scripts\ci-local.ps1 -Step audit   (roda so um passo)
# ============================================================

param(
    [switch]$SkipDocker,
    [string]$Step = "all"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$passed = 0
$failed = 0
$startTime = Get-Date

function Write-StepHeader($num, $name) {
    Write-Host ""
    Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [$num/8] $name" -ForegroundColor Cyan
    Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
}

function Invoke-Step($num, $name, [scriptblock]$block) {
    $shouldRun = ($Step -eq "all") -or ($Step -eq $num.ToString()) -or ($Step -eq $name)
    if (-not $shouldRun) {
        Write-Host "  [$num/8] $name - SKIP" -ForegroundColor DarkGray
        return
    }

    Write-StepHeader $num $name
    $stepStart = Get-Date
    try {
        & $block
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            throw "Process exited with code $LASTEXITCODE"
        }
        $elapsed = [int]((Get-Date) - $stepStart).TotalSeconds
        Write-Host "  [OK] PASSOU ($($elapsed)s)" -ForegroundColor Green
        $script:passed++
    }
    catch {
        $elapsed = [int]((Get-Date) - $stepStart).TotalSeconds
        Write-Host "  [ERRO] FALHOU ($($elapsed)s): $_" -ForegroundColor Red
        $script:failed++
        Write-Summary
        exit 1
    }
}

function Write-Summary {
    $elapsed = [int]((Get-Date) - $startTime).TotalSeconds
    Write-Host ""
    Write-Host "===================================================" -ForegroundColor DarkGray
    if ($script:failed -eq 0) {
        Write-Host "  CI LOCAL PASSOU - $($script:passed) passos OK em $($elapsed)s" -ForegroundColor Green
        Write-Host "  Seguro para commitar e fazer push!" -ForegroundColor Green
    }
    else {
        Write-Host "  CI LOCAL FALHOU - $($script:failed) erro(s) em $($elapsed)s" -ForegroundColor Red
        Write-Host "  Corrija antes de commitar!" -ForegroundColor Red
    }
    Write-Host "===================================================" -ForegroundColor DarkGray
    Write-Host ""
}

# ── Header ───────────────────────────────────────────────────
Write-Host ""
Write-Host "  KalendAI - CI Local (espelho do GitHub Actions)" -ForegroundColor Yellow
Write-Host "  Root: $root" -ForegroundColor DarkGray
if ($SkipDocker) {
    Write-Host "  Modo: -SkipDocker (builds Docker pulados)" -ForegroundColor DarkGray
}

Set-Location $root

# ── Passo 1: Install dependencies ────────────────────────────
Invoke-Step 1 "install" {
    npm ci
}

# ── Passo 2: Generate Prisma Client ──────────────────────────
Invoke-Step 2 "prisma" {
    npm run prisma:generate --workspace=backend
}

# ── Passo 3: Lint ────────────────────────────────────────────
Invoke-Step 3 "lint" {
    npm run lint --workspaces
}

# ── Passo 4: Tests ───────────────────────────────────────────
Invoke-Step 4 "test" {
    npm run test --workspace=backend
}

# ── Passo 5: Build ───────────────────────────────────────────
Invoke-Step 5 "build" {
    npm run build --workspaces
}

# ── Passo 6: Audit ───────────────────────────────────────────
Invoke-Step 6 "audit" {
    npm audit --audit-level=high --omit=dev
}

# ── Passo 7: Docker build frontend ───────────────────────────
if (-not $SkipDocker) {
    Invoke-Step 7 "docker-frontend" {
        docker build ./frontend --tag kalendai-frontend:ci
    }
}
else {
    Write-Host "  [7/8] docker-frontend - SKIP (-SkipDocker)" -ForegroundColor DarkGray
}

# ── Passo 8: Docker build backend ────────────────────────────
if (-not $SkipDocker) {
    Invoke-Step 8 "docker-backend" {
        docker build ./backend --tag kalendai-backend:ci
    }
}
else {
    Write-Host "  [8/8] docker-backend - SKIP (-SkipDocker)" -ForegroundColor DarkGray
}

Write-Summary
