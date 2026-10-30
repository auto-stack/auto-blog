// authoring_t01.cjs — BLOG-002 T-01 定向验收（Vue 轨）：作者任务全链。
// 前置: 后端 service --server rust 已起于 RW_API（隔离 AUTO_BLOG_DATA）；前端 build+preview 于 RW_URL。
// 空稿规则: 新建 markdown 稿先 textarea 起稿；正文非空后「切引擎」；有内容重开默认引擎。
// 输出 `PASS|FAIL <name> <json>`；`SUMMARY {...}`；退出码 0=全过。
//   node tests/probe/authoring_t01.cjs <front_url> <api_url>
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium, request } = require(path.join(root, 'tests/node_modules/@playwright/test'));

const URL = process.argv[2];
const API = process.argv[3];
if (!URL || !API) { console.error('usage: authoring_t01.cjs <front> <api>'); process.exit(2); }

const MD_V1 = '# 探针标题\n\n第一段：**加粗**与*斜体*。\n\n> 引用一行\n\n- 列表甲\n- 列表乙';
const COVER = 'https://example.com/cover.png';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
}
const settle = async (page) => {
  await page.waitForTimeout(3500);
  if (await page.getByText(/保存冲突：/).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '保留本机版本' }).click();
    await page.getByText('● 已保存').waitFor({ timeout: 15000 });
  }
};

(async () => {
  const api = await request.newContext({ baseURL: API });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  let wid = '';
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    await page.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });

    // T01-01 新建：空稿起稿面 = textarea（+空稿提示），格式默认 markdown
    await page.getByRole('button', { name: '新建草稿' }).click();
    await page.locator('textarea').waitFor({ timeout: 20000 });
    const idText = await page.getByText(/ID w-/).textContent();
    wid = (idText.match(/w-\d+-\d+/) || [''])[0];
    const hint = await page.getByText('空稿可直接输入；正文非空后可切引擎编辑器').isVisible();
    record('T01-01-new-empty-startface', wid !== '' && hint, { wid, hint });

    // T01-02 textarea 起稿（Markdown 语法文本）→ 切引擎 → 引擎渲染
    await page.locator('textarea').fill(MD_V1);
    await page.getByRole('button', { name: '编辑器：降级 · 切引擎' }).click();
    await page.locator('.autodown-editor').waitFor({ timeout: 20000 });
    const edH1 = await page.locator('.autodown-editor h1', { hasText: '探针标题' }).count();
    record('T01-02-start-then-engine', edH1 > 0, { h1: edH1 });

    // T01-03 引擎内追加输入（click 已有内容编辑器）+ 元数据 + 手动保存
    await page.locator('[data-engine-editor]').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n\n引擎内追加T01');
    await page.waitForTimeout(600);
    await page.getByPlaceholder('文章标题').fill('T01中文标题"引号"');
    await page.getByPlaceholder('摘要（可选）').fill('T01摘要');
    await page.getByPlaceholder('标签（逗号分隔）').fill('t01,markdown');
    await page.getByPlaceholder('封面（图片 URL 或资产引用，可选）').fill(COVER);
    await settle(page);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('● 已保存').waitFor({ timeout: 15000 });
    record('T01-03-engine-edit-and-save', true, { wid });

    // T01-04 独立 HTTP 读回：全字段含 body_format/cover/引擎内追加
    const st = await api.get(`/api/drafts/${wid}`);
    const w = await st.json();
    const bodyOk = (w.body || '').includes('探针标题') && (w.body || '').includes('引擎内追加T01');
    record('T01-04-api-readback', st.status() === 200 && bodyOk
      && w.title === 'T01中文标题"引号"' && w.summary === 'T01摘要' && w.tags === 't01,markdown'
      && w.cover_asset === COVER && w.body_format === 'markdown',
      { status: st.status(), body_format: w.body_format, cover: w.cover_asset, bodyHasAppend: (w.body || '').includes('引擎内追加T01') });

    // T01-05 降级保稿（AC-02 应用内臂）：切降级 → 内容保留 → 追加 → 保存
    await page.getByRole('button', { name: '编辑器：引擎 · 切降级' }).click();
    const ta = page.locator('textarea');
    await ta.waitFor({ timeout: 10000 });
    const kept = (await ta.inputValue()).includes('引擎内追加T01');
    await ta.fill((await ta.inputValue()) + '\n\n降级追加段落T01');
    await settle(page);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('● 已保存').waitFor({ timeout: 15000 });
    const w5 = await (await api.get(`/api/drafts/${wid}`)).json();
    record('T01-05-fallback-keeps-body', kept && (w5.body || '').includes('降级追加段落T01'),
      { kept, revision: w5.revision });

    // T01-06 格式切换 markdown→text→markdown（不改正文，落盘可见）
    await page.getByRole('button', { name: '格式：Markdown · 切纯文本' }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('● 已保存').waitFor({ timeout: 15000 });
    const w6a = await (await api.get(`/api/drafts/${wid}`)).json();
    await page.getByRole('button', { name: '格式：纯文本 · 切Markdown' }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('● 已保存').waitFor({ timeout: 15000 });
    const w6b = await (await api.get(`/api/drafts/${wid}`)).json();
    record('T01-06-format-switch-persists', w6a.body_format === 'text' && w6b.body_format === 'markdown'
      && (w6b.body || '').includes('降级追加段落T01'),
      { after_text: w6a.body_format, after_md: w6b.body_format });

    // T01-07 刷新重开：有内容稿默认引擎形态且正文完整
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });
    await page.getByText('T01中文标题"引号"').first().click();
    await page.locator('.autodown-editor').waitFor({ timeout: 20000 });
    const edText = await page.locator('.autodown-editor').textContent();
    record('T01-07-reopen-engine-roundtrip', (edText || '').includes('探针标题'),
      { snippet: (edText || '').slice(0, 40) });

    // 已知边界（BLOG-004 复审登记 / PLAN-015 spec）：App 启动时序 auth token null
    // pageerror —— 非 T-01 范围；其余页面错误仍判失败。
    const known = e => e.includes("Cannot read properties of null (reading 'token')");
    const fresh = errors.filter(e => !known(e));
    record('T01-08-no-page-errors', fresh.length === 0,
      { fresh: fresh.slice(0, 3), known_filtered: errors.length - fresh.length });
  } catch (e) {
    record('T01-EXCEPTION', false, { error: String(e).slice(0, 300), wid });
  } finally {
    await browser.close();
  }
  const passed = results.filter(r => r.ok).length;
  console.log(`SUMMARY ${JSON.stringify({ passed, failed: results.length - passed })}`);
  process.exit(passed === results.length ? 0 : 1);
})();
