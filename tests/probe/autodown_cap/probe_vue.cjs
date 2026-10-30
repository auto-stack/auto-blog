// probe_vue.cjs — BLOG-002 T-00 能力探针（Vue 轨）：AutoDown 引擎挂载/编辑回传/
// 渲染预览/降级切换。用法：node tests/probe/autodown_cap/probe_vue.cjs <front_url>
// 输出 `PASS|FAIL <name> <json>`；汇总 `SUMMARY {...}`；退出码 0=全过，1=有失败。
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(root, 'tests/node_modules/@playwright/test'));

const URL = process.argv[2] || 'http://127.0.0.1:17836';
const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('AutoDown 能力探针', { exact: true }).waitFor({ timeout: 30000 });

    // CAP-01 引擎编辑器挂载 + 常见 Markdown 块渲染（编辑器容器内）
    const editorRoot = page.locator('.autodown-editor');
    await editorRoot.waitFor({ timeout: 20000 });
    const edH1 = await editorRoot.locator('h1', { hasText: '能力探针' }).count();
    const edStrong = await editorRoot.locator('strong', { hasText: '加粗' }).count();
    const edQuote = await editorRoot.locator('blockquote').count();
    const edList = await editorRoot.locator('li', { hasText: '列表甲' }).count();
    record('CAP-01-editor-mount', edH1 > 0 && edStrong > 0 && edQuote > 0 && edList > 0,
      { h1: edH1, strong: edStrong, blockquote: edQuote, li: edList });

    // CAP-02 渲染预览（StreamingRenderer）：标题/引用/表格/图片/代码
    const prev = page.locator('.streaming-document');
    await prev.waitFor({ timeout: 20000 });
    const pvH1 = await prev.locator('h1').count();
    const pvQuote = await prev.locator('blockquote').count();
    const pvTable = await prev.locator('table').count();
    const pvImg = await prev.locator('img').count();
    const pvCode = await prev.locator('pre').count();
    record('CAP-02-preview-render', pvH1 > 0 && pvQuote > 0 && pvTable > 0 && pvImg > 0 && pvCode > 0,
      { h1: pvH1, quote: pvQuote, table: pvTable, img: pvImg, pre: pvCode });

    // CAP-03 编辑回传：点击编辑器末尾并键入追加段，预览出现新内容（oninput→content→renderer）
    await editorRoot.locator('[data-engine-editor]').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n\n新增段落探针XYZ');
    await prev.getByText('新增段落探针XYZ').waitFor({ timeout: 15000 });
    record('CAP-03-edit-propagation', true, { typed: '新增段落探针XYZ' });

    // CAP-04 降级切换：textarea 出现且内容保留；fill 后预览仍更新（fallback 可写稿）
    await page.getByRole('button', { name: '切换编辑器形态' }).click();
    const ta = page.locator('textarea');
    await ta.waitFor({ timeout: 10000 });
    const taVal = await ta.inputValue();
    const kept = taVal.includes('新增段落探针XYZ');
    await ta.fill('# 降级标题\n\n降级正文段落ABC');
    await prev.getByText('降级正文段落ABC').waitFor({ timeout: 15000 });
    record('CAP-04-fallback-textarea', kept, { kept_typed: kept });

    // CAP-05 切回引擎：引擎重新挂载且显示降级后的内容（模式可逆）
    await page.getByRole('button', { name: '切换编辑器形态' }).click();
    await editorRoot.waitFor({ timeout: 10000 });
    const backH1 = await editorRoot.locator('h1', { hasText: '降级标题' }).count();
    record('CAP-05-fallback-reversible', backH1 > 0, { h1_after_switch_back: backH1 });

    record('CAP-06-no-page-errors', errors.length === 0, { errors: errors.slice(0, 5) });
  } catch (e) {
    record('CAP-EXCEPTION', false, { error: String(e).slice(0, 300) });
  } finally {
    await browser.close();
  }
  const passed = results.filter(r => r.ok).length;
  console.log(`SUMMARY ${JSON.stringify({ passed, failed: results.length - passed })}`);
  process.exit(passed === results.length ? 0 : 1);
})();
