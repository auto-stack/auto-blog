// authoring_t04.cjs — BLOG-002 T-04 定向验收（Vue 轨）：切换编辑/预览同 ID/rev；渲染不写回原稿。
//   node tests/probe/authoring_t04.cjs <front_url> <api_url>
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, request } = require(path.join(root, 'tests/node_modules/@playwright/test'));

const URL = process.argv[2];
const API = process.argv[3];
if (!URL || !API) { console.error('usage: authoring_t04.cjs <front> <api>'); process.exit(2); }

const FIX = path.resolve(__dirname, '../fixtures/authoring');
const BODY = '# T04标题\n\n中文段落：**加粗**、*斜体*、`代码`。\n\n> 引用一行\n\n- 列表甲\n- 列表乙\n\n1. 有序一\n\n![图注](https://example.com/t04.png)\n\n```rust\nfn main() {}\n```';
const sha = s => crypto.createHash('sha256').update(s, 'utf-8').digest('hex').slice(0, 16);

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
    const page = await browser.newPage();
    page.on('pageerror', e => { const m = e.message || ''; if (!m.includes("reading 'token'")) errors.push(m); });
    await page.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });

    await page.getByRole('button', { name: '新建草稿' }).click();
    await page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）').waitFor({ timeout: 20000 });
    const idText = await page.getByText(/ID w-/).textContent();
    wid = (idText.match(/w-\d+-\d+/) || [''])[0];
    await page.getByPlaceholder('文章标题').fill('T04切换稿');
    await page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）').fill(BODY);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('● 已保存').waitFor({ timeout: 15000 });
    const w0 = await (await api.get(`/api/drafts/${wid}`)).json();
    const baseSha = sha(w0.body);
    const baseRev = w0.revision;
    record('T04-01-baseline', baseSha === sha(BODY), { rev: baseRev, bodySha: baseSha });

    // T04-02 编辑形态互切（textarea起稿→引擎→降级）：ID 稳定、正文字节不变
    await page.getByRole('button', { name: /编辑器：降级 · 切引擎/ }).click();
    await page.locator('.autodown-editor').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /编辑器：引擎 · 切降级/ }).click();
    const ta = page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）');
    await ta.waitFor({ timeout: 10000 });
    const afterFallback = await ta.inputValue();
    await page.getByRole('button', { name: /编辑器：降级 · 切引擎/ }).click();
    await page.locator('.autodown-editor').waitFor({ timeout: 10000 });
    const idText2 = await page.getByText(/ID w-/).textContent();
    record('T04-02-mode-switch-stable', idText2.includes(wid) && afterFallback === BODY,
      { sameId: idText2.includes(wid), bodyUnchanged: afterFallback === BODY });

    // T04-03 预览往返：正文字节不变、rev 不变（无渲染转换写回）
    await page.getByRole('button', { name: '预览', exact: true }).click();
    await page.locator('.streaming-document').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '返回编辑' }).click();
    await page.locator('.autodown-editor').waitFor({ timeout: 10000 });
    // 引擎形态读内容：经降级 textarea 读字节级值
    await page.getByRole('button', { name: /编辑器：引擎 · 切降级/ }).click();
    await ta.waitFor({ timeout: 10000 });
    const afterPreview = await ta.inputValue();
    const w1 = await (await api.get(`/api/drafts/${wid}`)).json();
    record('T04-03-preview-no-writeback', afterPreview === BODY && sha(w1.body) === baseSha && w1.revision === baseRev,
      { bodyEq: afterPreview === BODY, serverShaEq: sha(w1.body) === baseSha, rev: w1.revision });

    // T04-04 预览期间编辑后保存 → rev 推进；再次预览往返不产生幻影写
    await ta.fill(BODY + '\n\nT04追加段');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await page.getByText('● 已保存').waitFor({ timeout: 15000 });
    const w2 = await (await api.get(`/api/drafts/${wid}`)).json();
    await page.getByRole('button', { name: '预览', exact: true }).click();
    await page.locator('.streaming-document').waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '返回编辑' }).click();
    const ta2 = page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）');
    await ta2.waitFor({ timeout: 10000 });
    const w3 = await (await api.get(`/api/drafts/${wid}`)).json();
    record('T04-04-edit-save-then-preview-idle', w2.revision === baseRev + 1 && w3.revision === w2.revision
      && sha(w3.body) === sha(BODY + '\n\nT04追加段'),
      { rev_after_save: w2.revision, rev_after_preview: w3.revision });

    // T04-05 刷新重开：同 work_id，正文含追加段（roundtrip）
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });
    await page.getByText('T04切换稿').last().click();
    await page.locator('.autodown-editor').waitFor({ timeout: 20000 });
    const idText3 = await page.getByText(/ID w-/).textContent();
    record('T04-05-reopen-same-id', idText3.includes(wid), { sameId: idText3.includes(wid) });

    // T04-06 多源导入创建新 work，不覆盖现有稿（AC-04）
    const before = await (await api.get(`/api/drafts/${wid}`)).json();
    const env1 = JSON.parse(fs.readFileSync(path.join(FIX, 'notes-envelope-1.json'), 'utf-8'));
    const env2 = JSON.parse(fs.readFileSync(path.join(FIX, 'reader-quote-1.json'), 'utf-8'));
    await page.getByPlaceholder(/\[\{producer:notes/).fill(JSON.stringify([env1, env2]));
    await page.getByRole('button', { name: '组合为新作品' }).click();
    await page.waitForFunction(
      () => { const el = document.querySelector('input[placeholder="文章标题"]'); return el && (el.value || '').startsWith('导入：'); },
      { timeout: 20000 });
    const idText4 = await page.getByText(/ID w-/).textContent();
    const newId = (idText4.match(/w-\d+-\d+/) || [''])[0];
    const after = await (await api.get(`/api/drafts/${wid}`)).json();
    record('T04-06-import-new-work', newId !== '' && newId !== wid && sha(after.body) === sha(before.body)
      && after.revision === before.revision,
      { newId, oldIntact: sha(after.body) === sha(before.body) });

    record('T04-07-no-page-errors', errors.length === 0, { errors: errors.slice(0, 3) });
  } catch (e) {
    record('T04-EXCEPTION', false, { error: String(e).slice(0, 260), wid });
  } finally {
    await browser.close();
  }
  const passed = results.filter(r => r.ok).length;
  console.log(`SUMMARY ${JSON.stringify({ passed, failed: results.length - passed })}`);
  process.exit(passed === results.length ? 0 : 1);
})();
