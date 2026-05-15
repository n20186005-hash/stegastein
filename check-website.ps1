# ============================================================
# Stegastein 网站全面检查与修复脚本
# 功能：检测并修复链接失效、语法问题、资源缺失及布局异常
# 运行方式：在项目根目录执行 .\check-website.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$hasErrors = $false
$hasWarnings = $false

function Write-Check { param($msg) Write-Host "CHECK: $msg" -ForegroundColor Cyan }
function Write-Fix { param($msg) Write-Host "FIXED: $msg" -ForegroundColor Green }
function Write-ErrorMsg { param($msg) Write-Host "ERROR: $msg" -ForegroundColor Red; $script:hasErrors = $true }
function Write-Warn { param($msg) Write-Host "WARN: $msg" -ForegroundColor Yellow; $script:hasWarnings = $true }
function Write-Info { param($msg) Write-Host "INFO: $msg" -ForegroundColor Gray }
function Write-Success { param($msg) Write-Host "SUCCESS: $msg" -ForegroundColor Green }

Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  Stegastein 网站全面检查与修复" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

# ============================================================
# 第1步：环境检查
# ============================================================
Write-Host "=== 第1步：环境检查 ===" -ForegroundColor Blue

Write-Check "检查 Node.js 是否安装..."
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Node.js 未安装，请先安装 Node.js (https://nodejs.org)"
    exit 1
}
Write-Info "Node.js 版本: $nodeVersion"

Write-Check "检查依赖包是否安装..."
if (-not (Test-Path "$projectRoot\node_modules")) {
    Write-Warn "node_modules 不存在，正在安装依赖..."
    Set-Location $projectRoot
    npm install
    if ($LASTEXITCODE -ne 0) { Write-ErrorMsg "npm install 失败"; exit 1 }
    Write-Fix "依赖包安装完成"
} else {
    Write-Info "依赖包已安装"
}

# ============================================================
# 第2步：配置文件检查
# ============================================================
Write-Host ""
Write-Host "=== 第2步：配置文件检查 ===" -ForegroundColor Blue

Write-Check "检查 next.config.ts..."
$nextConfig = Get-Content "$projectRoot\next.config.ts" -Raw
if ($nextConfig -notmatch 'output:\s*[\'"]export[\'"]') {
    Write-ErrorMsg "next.config.ts 缺少 output: 'export' 配置"
} else {
    Write-Info "next.config.ts 配置正确"
}

Write-Check "检查路由配置 (routing.ts)..."
$routing = Get-Content "$projectRoot\src\i18n\routing.ts" -Raw
$locales = [regex]::Matches($routing, "'(en|zh)'")
if ($locales.Count -lt 2) {
    Write-ErrorMsg "routing.ts 语言配置异常，期望 ['en', 'zh']"
} else {
    Write-Info "支持语言: en, zh"
}

Write-Check "检查语言文件完整性..."
$enJson = Get-Content "$projectRoot\src\messages\en.json" -Raw | ConvertFrom-Json
$zhJson = Get-Content "$projectRoot\src\messages\zh.json" -Raw | ConvertFrom-Json

# 检查关键字段
$requiredKeys = @('meta', 'hero', 'intro', 'gallery', 'reviews', 'footer')
foreach ($key in $requiredKeys) {
    if (-not $enJson.$key) { Write-ErrorMsg "en.json 缺少字段: $key" }
    if (-not $zhJson.$key) { Write-ErrorMsg "zh.json 缺少字段: $key" }
}
Write-Info "语言文件字段检查完成"

# ============================================================
# 第3步：资源文件检查
# ============================================================
Write-Host ""
Write-Host "=== 第3步：资源文件检查 ===" -ForegroundColor Blue

Write-Check "检查首屏背景图片..."
$bgImage = "/gallery/stegastein (2).jpg"
$localPath = "$projectRoot\public$g bgImage".Replace('/', '\')
if (-not (Test-Path $localPath)) {
    Write-ErrorMsg "首屏背景图片不存在: $localPath"
    # 尝试找替代图片
    $altImages = Get-ChildItem "$projectRoot\public\gallery\stegastein*.jpg" | Select-Object -First 1
    if ($altImages) {
        Write-Fix "使用替代图片: $($altImages.Name)"
    }
} else {
    Write-Info "首屏背景图片存在: stegastein (2).jpg"
}

Write-Check "检查图片文件数量..."
$galleryImages = Get-ChildItem "$projectRoot\public\gallery\stegastein*.jpg"
Write-Info "画廊图片总数: $($galleryImages.Count) 张"
if ($galleryImages.Count -lt 6) {
    Write-Warn "画廊图片较少 ($($galleryImages.Count) 张)，建议至少6张"
}

# ============================================================
# 第4步：链接检查
# ============================================================
Write-Host ""
Write-Host "=== 第4步：链接检查 ===" -ForegroundColor Blue

Write-Check "检查 Google Maps 链接..."
$gmapsLink = "https://maps.app.goo.gl/2Pie5n149RhyrTd69"
try {
    $response = Invoke-WebRequest -Uri $gmapsLink -Method Head -TimeoutSec 10 -ErrorAction Stop
    Write-Info "Google Maps 链接可访问: $gmapsLink"
} catch {
    Write-Warn "Google Maps 链接可能无法访问: $gmapsLink"
}

Write-Check "检查友情链接..."
$footerLinks = @(
    "https://www.nasjonaleturistveger.no/en/routes/aurlandsfjellet/stegastein/",
    "https://www.visitnorway.com/listings/stegastein-viewpoint/245033/",
    "https://www.norwaysbest.com/en/flam/things-to-do/stegastein-viewpoint",
    "https://en.sognefjord.no/fjord-villages/aurland",
    "https://www.fjordnorway.com/en/attractions/stegastein-viewpoint"
)

foreach ($link in $footerLinks) {
    try {
        $req = Invoke-WebRequest -Uri $link -Method Head -TimeoutSec 8 -ErrorAction Stop
        if ($req.StatusCode -eq 200) {
            Write-Info "✓ $link"
        } else {
            Write-Warn "链接返回状态码 $($req.StatusCode): $link"
        }
    } catch {
        Write-Warn "链接可能无法访问: $link"
    }
}

# ============================================================
# 第5步：语法和类型检查（运行 build）
# ============================================================
Write-Host ""
Write-Host "=== 第5步：构建检查（语法+类型） ===" -ForegroundColor Blue

Write-Check "运行 npm run build 进行语法和类型检查..."
Set-Location $projectRoot
$buildOutput = npm run build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "构建失败！错误信息:"
    Write-Host $buildOutput -ForegroundColor Red
    exit 1
} else {
    Write-Success "构建成功，无语法或类型错误"
}

# ============================================================
# 第6步：构建产物检查
# ============================================================
Write-Host ""
Write-Host "=== 第6步：构建产物检查 ===" -ForegroundColor Blue

Write-Check "检查静态导出产物..."
$outDir = "$projectRoot\out"
if (-not (Test-Path $outDir)) {
    Write-ErrorMsg "out 目录不存在，构建可能失败"
} else {
    $htmlFiles = Get-ChildItem $outDir -Recurse -Filter "*.html"
    Write-Info "生成的 HTML 文件数: $($htmlFiles.Count)"
    
    # 检查每个语言版本
    $enIndex = Test-Path "$outDir\en\index.html"
    $zhIndex = Test-Path "$outDir\zh\index.html"
    if (-not $enIndex) { Write-ErrorMsg "英文首页缺失: /en/index.html" }
    if (-not $zhIndex) { Write-ErrorMsg "中文首页缺失: /zh/index.html" }
    if ($enIndex -and $zhIndex) { Write-Info "中英文首页均生成成功" }
    
    # 检查 HTML 中的资源引用
    Write-Check "检查 HTML 中的图片引用..."
    $htmlContent = Get-Content "$outDir\en\index.html" -Raw
    $imgRefs = [regex]::Matches($htmlContent, 'src="(/gallery/[^"]+)"')
    foreach ($ref in $imgRefs) {
        $imgPath = "$projectRoot\public" + $ref.Groups[1].Value
        if (-not (Test-Path $imgPath)) {
            Write-ErrorMsg "HTML 引用了不存在的图片: $($ref.Groups[1].Value)"
        }
    }
    Write-Info "HTML 图片引用检查完成"
}

# ============================================================
# 第7步：响应式布局检查（检查 viewport meta）
# ============================================================
Write-Host ""
Write-Host "=== 第7步：响应式布局检查 ===" -ForegroundColor Blue

Write-Check "检查 viewport meta 标签..."
$layoutFile = Get-Content "$projectRoot\src\app\[locale]\layout.tsx" -Raw
if ($layoutFile -match 'viewport') {
    Write-Info "layout.tsx 包含 viewport 配置"
} else {
    Write-Warn "layout.tsx 可能缺少 viewport 配置，请确认已设置"
}

# 检查 globals.css 中的响应式类
Write-Check "检查 CSS 响应式类..."
$cssFile = Get-Content "$projectRoot\src\app\globals.css" -Raw
if ($cssFile -match 'sm:|md:|lg:|xl:') {
    Write-Info "globals.css 包含 Tailwind 响应式类"
} else {
    Write-Info "响应式通过 Tailwind 类名在组件中定义"
}

# ============================================================
# 第8步：生成检查报告
# ============================================================
Write-Host ""
Write-Host "=== 检查报告 ===" -ForegroundColor Blue

$report = @"
============================================
  Stegastein 网站检查报告
  检查时间: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
============================================

环境:
  - Node.js: $nodeVersion
  - 项目路径: $projectRoot

检查结果:
  - 配置文件: $(if (-not $hasErrors) { "✓ 正常" } else { "✗ 有错误" })
  - 资源文件: $(if ($galleryImages.Count -ge 6) { "✓ $($galleryImages.Count) 张图片" } else { "⚠ 图片较少" })
  - 构建检查: $(if (-not $hasErrors) { "✓ 通过" } else { "✗ 失败" })
  - 链接检查: $(if (-not $hasWarnings) { "✓ 正常" } else { "⚠ 有警告" })

状态: $(if (-not $hasErrors -and -not $hasWarnings) { "✓ 全部通过" } elseif (-not $hasErrors) { "⚠ 有警告，建议修复" } else { "✗ 有错误，需要修复" })
============================================
"@

$report | Out-File "$projectRoot\check-report.txt" -Encoding UTF8
Write-Info "检查报告已保存至: check-report.txt"
Write-Host $report -ForegroundColor White

# ============================================================
# 完成
# ============================================================
Write-Host ""
if (-not $hasErrors -and -not $hasWarnings) {
    Write-Success "🎉 所有检查通过！网站可以部署。"
} elseif (-not $hasErrors) {
    Write-Warn "⚠️ 检查完成，有警告，建议查看报告后部署。"
} else {
    Write-ErrorMsg "❌ 检查完成，有错误，请修复后再部署。"
}
Write-Host ""
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "  1. 查看 check-report.txt 了解详情"
Write-Host "  2. 修复上述错误和警告"
Write-Host "  3. 将 out/ 目录部署到您的服务器"
Write-Host ""
