// ============================================================
// Stegastein 网站全面检查与修复脚本
// 运行：node check-website.js
// ============================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');
const http = require('http');

const projectRoot = __dirname;
let hasErrors = false;
let hasWarnings = false;

function log(msg, color = 'cyan') {
  const colors = { cyan: 36, green: 32, red: 31, yellow: 33, gray: 90, magenta: 35, white: 37 };
  console.log(`\x1b[${colors[color] || 37}m${msg}\x1b[0m`);
}

function logSuccess(msg) { log(`  ✓ ${msg}`, 'green'); }
function logError(msg) { log(`  ✗ ERROR: ${msg}`, 'red'); hasErrors = true; }
function logWarn(msg) { log(`  ⚠ WARN: ${msg}`, 'yellow'); hasWarnings = true; }
function logInfo(msg) { log(`  • ${msg}`, 'gray'); }

async function checkUrl(url, timeout = 8000) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function main() {
  console.log('============================================');
  log('  Stegastein 网站全面检查与修复', 'magenta');
  console.log('============================================\n');

  // 第1步：环境检查
  log('=== 第1步：环境检查 ===', 'blue');
  log('检查 Node.js...', 'cyan');
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    logInfo(`Node.js 版本: ${nodeVersion}`);
  } catch (e) {
    logError('Node.js 未安装，请先安装 Node.js (https://nodejs.org)');
    process.exit(1);
  }

  log('检查依赖包...', 'cyan');
  const nodeModulesPath = path.join(projectRoot, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    logWarn('node_modules 不存在，正在安装依赖...');
    try {
      execSync('npm install', { cwd: projectRoot, stdio: 'inherit' });
      logSuccess('依赖包安装完成');
    } catch (e) {
      logError('npm install 失败');
      process.exit(1);
    }
  } else {
    logInfo('依赖包已安装');
  }

  // 第2步：配置文件检查
  console.log('');
  log('=== 第2步：配置文件检查 ===', 'blue');

  log('检查 next.config.ts...', 'cyan');
  const nextConfigPath = path.join(projectRoot, 'next.config.ts');
  const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
  if (!nextConfig.match(/output:\s*['"]export['"]/)) {
    logError("next.config.ts 缺少 output: 'export' 配置");
  } else {
    logSuccess('next.config.ts 配置正确');
  }

  log('检查路由配置 (routing.ts)...', 'cyan');
  const routingPath = path.join(projectRoot, 'src/i18n/routing.ts');
  const routing = fs.readFileSync(routingPath, 'utf8');
  if (!routing.includes("'en'") || !routing.includes("'zh'")) {
    logError("routing.ts 语言配置异常，期望 ['en', 'zh']");
  } else {
    logInfo('支持语言: en, zh');
  }

  log('检查语言文件完整性...', 'cyan');
  const enJsonPath = path.join(projectRoot, 'src/messages/en.json');
  const zhJsonPath = path.join(projectRoot, 'src/messages/zh.json');
  
  if (!fs.existsSync(enJsonPath)) logError('en.json 不存在');
  if (!fs.existsSync(zhJsonPath)) logError('zh.json 不存在');
  
  if (fs.existsSync(enJsonPath) && fs.existsSync(zhJsonPath)) {
    try {
      const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
      const zhJson = JSON.parse(fs.readFileSync(zhJsonPath, 'utf8'));
      const requiredKeys = ['meta', 'hero', 'intro', 'gallery', 'reviews', 'footer'];
      let missingEn = [], missingZh = [];
      for (const key of requiredKeys) {
        if (!enJson[key]) missingEn.push(key);
        if (!zhJson[key]) missingZh.push(key);
      }
      if (missingEn.length) logError(`en.json 缺少字段: ${missingEn.join(', ')}`);
      if (missingZh.length) logError(`zh.json 缺少字段: ${missingZh.join(', ')}`);
      if (!missingEn.length && !missingZh.length) logSuccess('语言文件字段检查完成');
    } catch (e) {
      logError(`JSON 解析错误: ${e.message}`);
    }
  }

  // 第3步：资源文件检查
  console.log('');
  log('=== 第3步：资源文件检查 ===', 'blue');

  log('检查首屏背景图片...', 'cyan');
  const bgImagePath = path.join(projectRoot, 'public/gallery/stegastein (2).jpg');
  if (!fs.existsSync(bgImagePath)) {
    logError('首屏背景图片不存在: stegastein (2).jpg');
    // 找替代图片
    const galleryDir = path.join(projectRoot, 'public/gallery');
    if (fs.existsSync(galleryDir)) {
      const files = fs.readdirSync(galleryDir).filter(f => f.endsWith('.jpg'));
      if (files.length > 0) {
        logWarn(`使用替代图片: ${files[0]}`);
      }
    }
  } else {
    logSuccess('首屏背景图片存在: stegastein (2).jpg');
  }

  log('检查图片文件数量...', 'cyan');
  const galleryDir = path.join(projectRoot, 'public/gallery');
  let imageCount = 0;
  if (fs.existsSync(galleryDir)) {
    const files = fs.readdirSync(galleryDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    imageCount = files.length;
    logInfo(`画廊图片总数: ${imageCount} 张`);
    if (imageCount < 6) logWarn(`画廊图片较少 (${imageCount} 张)，建议至少6张`);
  }

  // 第4步：链接检查
  console.log('');
  log('=== 第4步：链接检查 ===', 'blue');

  log('检查 Google Maps 链接...', 'cyan');
  const gmapsLink = 'https://maps.app.goo.gl/2Pie5n149RhyrTd69';
  const gmapsOk = await checkUrl(gmapsLink);
  if (gmapsOk) {
    logSuccess(`Google Maps 链接可访问: ${gmapsLink}`);
  } else {
    logWarn(`Google Maps 链接可能无法访问: ${gmapsLink}`);
  }

  log('检查友情链接...', 'cyan');
  const footerLinks = [
    'https://www.nasjonaleturistveger.no/en/routes/aurlandsfjellet/stegastein/',
    'https://www.visitnorway.com/listings/stegastein-viewpoint/245033/',
    'https://www.norwaysbest.com/en/flam/things-to-do/stegastein-viewpoint',
    'https://en.sognefjord.no/fjord-villages/aurland',
    'https://www.fjordnorway.com/en/attractions/stegastein-viewpoint'
  ];
  
  for (const link of footerLinks) {
    const ok = await checkUrl(link);
    if (ok) {
      logInfo(`✓ ${link}`);
    } else {
      logWarn(`链接可能无法访问: ${link}`);
    }
  }

  // 第5步：构建检查
  console.log('');
  log('=== 第5步：构建检查（语法+类型） ===', 'blue');
  log('运行 npm run build...', 'cyan');
  try {
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
    logSuccess('构建成功，无语法或类型错误');
  } catch (e) {
    logError('构建失败！请查看上方错误信息');
  }

  // 第6步：构建产物检查
  console.log('');
  log('=== 第6步：构建产物检查 ===', 'blue');
  const outDir = path.join(projectRoot, 'out');
  if (!fs.existsSync(outDir)) {
    logError('out 目录不存在，构建可能失败');
  } else {
    logSuccess('out 目录存在');

    // Next.js output: 'export' + localePrefix: 'as-needed'
    // 默认语言(en) → out/index.html
    // 非默认语言(zh) → out/zh/index.html
    const enIndex = fs.existsSync(path.join(outDir, 'index.html'))
                    || fs.existsSync(path.join(outDir, 'en.html'));
    const zhIndex = fs.existsSync(path.join(outDir, 'zh/index.html'))
                    || fs.existsSync(path.join(outDir, 'zh.html'));
    if (!enIndex) logError('英文首页缺失: /index.html 或 /en.html');
    if (!zhIndex) logError('中文首页缺失: /zh/index.html 或 /zh.html');
    if (enIndex && zhIndex) logSuccess('中英文首页均生成成功');

    // 检查 HTML 中的图片引用（检查英文默认首页）
    log('检查 HTML 中的图片引用...', 'cyan');
    const htmlPathsToCheck = [
      path.join(outDir, 'index.html'),
      path.join(outDir, 'en.html'),
      path.join(outDir, 'zh/index.html'),
      path.join(outDir, 'zh.html'),
    ];
    let imgErrors = 0;
    for (const htmlPath of htmlPathsToCheck) {
      if (!fs.existsSync(htmlPath)) continue;
      const htmlContent = fs.readFileSync(htmlPath, 'utf8');
      const imgRegex = /src="(\/gallery\/[^"]+)"/g;
      let match;
      while ((match = imgRegex.exec(htmlContent)) !== null) {
        const imgPath = path.join(projectRoot, 'public', match[1]);
        if (!fs.existsSync(imgPath)) {
          logError(`HTML 引用了不存在的图片: ${match[1]}`);
          imgErrors++;
        }
      }
    }
    if (imgErrors === 0) logSuccess('HTML 图片引用检查完成');
  }

  // 第7步：响应式布局检查
  console.log('');
  log('=== 第7步：响应式布局检查 ===', 'blue');
  log('检查 viewport 配置...', 'cyan');
  const layoutPath = path.join(projectRoot, 'src/app/[locale]/layout.tsx');
  if (fs.existsSync(layoutPath)) {
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    if (layoutContent.includes('generateViewport')) {
      logSuccess('layout.tsx 包含 generateViewport 配置');
    } else {
      logWarn('layout.tsx 可能缺少 viewport 配置');
    }
  }

  // 第8步：生成报告
  console.log('');
  log('=== 检查报告 ===', 'blue');
  const report = [
    '============================================',
    `  Stegastein 网站检查报告`,
    `  检查时间: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    '============================================',
    '',
    `环境:`,
    `  - Node.js: ${execSync('node --version', { encoding: 'utf8' }).trim()}`,
    `  - 项目路径: ${projectRoot}`,
    '',
    `检查结果:`,
    `  - 配置文件: ${!hasErrors ? '✓ 正常' : '✗ 有错误'}`,
    `  - 资源文件: ${imageCount >= 6 ? `✓ ${imageCount} 张图片` : '⚠ 图片较少'}`,
    `  - 构建检查: ${!hasErrors ? '✓ 通过' : '✗ 失败'}`,
    `  - 链接检查: ${!hasWarnings ? '✓ 正常' : '⚠ 有警告'}`,
    '',
    `状态: ${!hasErrors && !hasWarnings ? '✓ 全部通过' : !hasErrors ? '⚠ 有警告，建议修复' : '✗ 有错误，需要修复'}`,
    '============================================',
  ].join('\n');

  fs.writeFileSync(path.join(projectRoot, 'check-report.txt'), report, 'utf8');
  logInfo('检查报告已保存至: check-report.txt');
  console.log('\n' + report);

  console.log('');
  if (!hasErrors && !hasWarnings) {
    log('🎉 所有检查通过！网站可以部署。', 'green');
  } else if (!hasErrors) {
    log('⚠️ 检查完成，有警告，建议查看报告后部署。', 'yellow');
  } else {
    log('❌ 检查完成，有错误，请修复后再部署。', 'red');
  }

  console.log('');
  log('下一步:', 'cyan');
  log('  1. 查看 check-report.txt 了解详情', 'cyan');
  log('  2. 修复上述错误和警告', 'cyan');
  log('  3. 将 out/ 目录部署到您的服务器', 'cyan');
  console.log('');
}

main().catch(e => {
  logError(`脚本执行出错: ${e.message}`);
  process.exit(1);
});
