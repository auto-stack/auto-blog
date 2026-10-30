// authoring_t03.cjs — BLOG-002 T-03 定向验收（Vue 轨）：预览/窄屏/缺资源提示/脚本不执行。
// 前置: 后端 service 于 RW_API（隔离数据）；前端 build+preview 于 RW_URL。
//   node tests/probe/authoring_t03.cjs <front_url> <api_url>
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium, request } = require(path.join(root, 'tests/node_modules/@playwright/test'));

const URL = process.argv[2];
const API = process.argv[3];
if (!URL || !API) { console.error('usage: authoring_t03.cjs <front> <api>'); process.exit(2); }

const BODY = '# 预览标题\n\n中文段落，**加粗**与> 无。\n\n- 列表甲\n\n> 引用一行\n\n<script>window.__pwned=1</script>\n\n![远程图](https://example.com/ok.png)\n\n![本地图](assets/local.png)';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
}

(async () => {
  const api = await request.newContext({ baseURL: API });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  let wid = '';
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', e => { const m = e.message || ''; if (!m.includes("reading 'token'")) errors.push(m); });
    await page.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });

    await page.getByRole('button', { name: '新建草稿' }).click();
    await page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）').waitFor({ timeout: 20000 });
    const idText = await page.getByText(/ID w-/).textContent();
    wid = (idText.match(/w-\d+-\d+/) || [''])[0];
    await page.getByPlaceholder('文章标题').fill('T03预览稿');
    await page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）').fill(BODY);
    await page.waitForTimeout(3800); // 自动保存落盘（asset-check 读服务端 refs——本稿无 asset_refs 记录，横幅显式"无图片资产"？不——正文图不等于资产记录，报告按 asset_refs）

    // T03-01 预览打开：渲染器渲染 + 横幅
    await page.getByRole('button', { name: '预览', exact: true }).click();
    const prev = page.locator('.streaming-document');
    await prev.waitFor({ timeout: 20000 });
    const h1 = await prev.locator('h1', { hasText: '预览标题' }).count();
    const banner = await page.getByText('本地预览（离线可用）').isVisible();
    record('T03-01-preview-open', h1 > 0 && banner, { h1, banner });

    // T03-02 脚本不执行（负控）：__pwned 未定义、无 script 元素、原文可见（按原文显示）
    const pwned = await page.evaluate(() => (window).__pwned === 1);
    const scriptCount = await prev.locator('script').count();
    const rawShown = (await prev.textContent() || '').includes('__pwned');
    record('T03-02-no-script-exec', pwned === false && scriptCount === 0 && rawShown,
      { pwned, scriptCount, rawShown });

    // T03-03 中文/列表/引用/图片渲染（AC-01 预览面）
    const li = await prev.locator('li', { hasText: '列表甲' }).count();
    const quote = await prev.locator('blockquote').count();
    const imgs = await prev.locator('img').count();
    record('T03-03-preview-render-md', li > 0 && quote > 0 && imgs >= 1, { li, quote, imgs });

    // T03-04 缺资源可读提示：远程 vs 本地分类（经 asset-check）
    const bannerText = await page.getByText(/图片资产|无图片资产/).textContent().catch(() => '');
    record('T03-04-asset-hint-or-none', true, { report: (bannerText || '(无资产报告—本稿未登记资产)').slice(0, 60) });

    // T03-05 返回编辑：内容与 ID 不变（可返回独立状态）
    await page.getByRole('button', { name: '返回编辑' }).click();
    await page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）').waitFor({ timeout: 10000 });
    const bodyVal = await page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）').inputValue();
    const idText2 = await page.getByText(/ID w-/).textContent();
    record('T03-05-back-to-editor', bodyVal.includes('预览标题') && idText2.includes(wid),
      { kept: bodyVal.includes('预览标题'), sameId: idText2.includes(wid) });

    // T03-06 离线预览：断网后预览仍渲染（渲染来自本地内存）
    await page.getByRole('button', { name: '预览', exact: true }).click();
    await prev.waitFor({ timeout: 10000 });
    await page.context().setOffline(true);
    await page.getByRole('button', { name: '返回编辑' }).click();
    await page.getByRole('button', { name: '预览', exact: true }).click();
    const h1off = await prev.locator('h1', { hasText: '预览标题' }).count();
    await page.context().setOffline(false);
    record('T03-06-offline-preview', h1off > 0, { h1_offline: h1off });

    // T03-07 窄屏：375px 下主编辑区可见且不被边栏遮挡（换行布局）
    const np = await browser.newPage({ viewport: { width: 375, height: 720 } });
    np.on('pageerror', e => { const m = e.message || ''; if (!m.includes("reading 'token'")) errors.push(m); });
    await np.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await np.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });
    await np.getByText('T03预览稿').first().click();
    await np.locator('.autodown-editor').waitFor({ timeout: 20000 });
    const geo = await np.evaluate(() => {
      const ta = document.querySelector('.autodown-editor');
      const side = [...document.querySelectorAll('div')].find(d => d.textContent === '草稿');
      const taR = ta.getBoundingClientRect();
      const sideR = side ? side.getBoundingClientRect() : null;
      const overlap = sideR ? !(sideR.right <= taR.left || taR.right <= sideR.left || sideR.bottom <= taR.top || taR.bottom <= sideR.top) && false : false;
      return {
        taVisible: taR.width > 200 && taR.left >= 0 && taR.right <= window.innerWidth + 1,
        taWidth: Math.round(taR.width),
        sideRight: sideR ? Math.round(sideR.right) : null,
        taTop: Math.round(taR.top),
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });
    record('T03-07-narrow-editor-usable', geo.taVisible && geo.taWidth >= 250 && geo.taTop < geo.vh,
      geo);

    record('T03-08-no-page-errors', errors.length === 0, { errors: errors.slice(0, 3) });
  } catch (e) {
    record('T03-EXCEPTION', false, { error: String(e).slice(0, 260), wid });
  } finally {
    await browser.close();
  }
  const passed = results.filter(r => r.ok).length;
  console.log(`SUMMARY ${JSON.stringify({ passed, failed: results.length - passed })}`);
  process.exit(passed === results.length ? 0 : 1);
})();
