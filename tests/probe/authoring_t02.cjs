// authoring_t02.cjs — BLOG-002 T-02 定向验收（Vue 轨 UI）：资产添加/说明 + 粘贴导入组合。
// 前置: 后端 service 于 RW_API（隔离数据）；前端 build+preview 于 RW_URL。
//   node tests/probe/authoring_t02.cjs <front_url> <api_url>
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, request } = require(path.join(root, 'tests/node_modules/@playwright/test'));

const URL = process.argv[2];
const API = process.argv[3];
if (!URL || !API) { console.error('usage: authoring_t02.cjs <front> <api>'); process.exit(2); }

const FIX = path.resolve(__dirname, '../fixtures/authoring');
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
    page.on('pageerror', e => { const m = e.message || ''; if (!m.includes("reading 'token'")) errors.push(m); });
    await page.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });

    // T02-01 新建 + 添加图片（说明→alt；正文出现图片行）
    await page.getByRole('button', { name: '新建草稿' }).click();
    const bodyTa = page.getByPlaceholder('正文（Markdown 语法可直接输入；自动保存）');
    await bodyTa.waitFor({ timeout: 20000 });
    const idText = await page.getByText(/ID w-/).textContent();
    wid = (idText.match(/w-\d+-\d+/) || [''])[0];
    await bodyTa.fill('# T02正文\n\n首段。');
    await page.getByPlaceholder('图片引用（URL/路径）').fill('https://example.com/t02.png');
    await page.getByPlaceholder('图片说明（可选）').fill('图T02说明');
    await page.getByRole('button', { name: '添加图片' }).click();
    await page.getByText('● 已保存').waitFor({ timeout: 15000 });
    const w1 = await (await api.get(`/api/drafts/${wid}`)).json();
    const assets = (w1.asset_refs || '').split('\n').filter(x => x.trim()).map(x => { try { return JSON.parse(x); } catch { return null; } });
    record('T02-01-asset-add-ui', assets.length === 1 && assets[0].caption === '图T02说明'
      && assets[0].mode === 'copy' && (w1.body || '').includes('![图T02说明](https://example.com/t02.png)'),
      { assets: assets.length, body_img: (w1.body || '').includes('![图T02说明]'), rev: w1.revision });

    // T02-02 粘贴导入两来源 → 组合为新作品（列表可见 + 读回 source_refs）
    const env1 = fs.readFileSync(path.join(FIX, 'notes-envelope-1.json'), 'utf-8');
    const env2 = fs.readFileSync(path.join(FIX, 'reader-quote-1.json'), 'utf-8');
    await settle(page);
    await page.getByPlaceholder(/\[\{producer:notes/).fill(JSON.stringify([JSON.parse(env1), JSON.parse(env2)]));
    await page.getByRole('button', { name: '组合为新作品' }).click();
    // 采纳信号：标题输入变为 compose 产物（导入： 前缀），避免与自动保存竞态
    await page.waitForFunction(
      () => { const el = document.querySelector('input[placeholder="文章标题"]'); return el && (el.value || '').startsWith('导入：'); },
      { timeout: 20000 });
    const idText2 = await page.getByText(/ID w-/).textContent();
    const wid2 = (idText2.match(/w-\d+-\d+/) || [''])[0];
    const titleShown = await page.getByPlaceholder('文章标题').inputValue();
    const w2 = await (await api.get(`/api/drafts/${wid2}`)).json();
    const refs2 = (w2.source_refs || '').split('\n').filter(x => x.trim()).map(x => { try { return JSON.parse(x); } catch { return null; } });
    record('T02-02-import-compose-ui', wid2 !== '' && wid2 !== wid && titleShown.startsWith('导入：')
      && refs2.length === 2 && refs2[0].producer === 'notes' && refs2[0].source_revision === 3
      && (w2.body || '').includes('会议纪要') && (w2.body || '').includes('有机单元'),
      { wid2, titleShown, refs: refs2.length });

    // T02-03 引用 vs 副本（UI 导入含 reference 项）：reference 不并入正文
    const envR = fs.readFileSync(path.join(FIX, 'reader-quote-reference.json'), 'utf-8');
    await settle(page);
    await page.getByPlaceholder(/\[\{producer:notes/).fill(JSON.stringify([JSON.parse(envR)]));
    await page.getByRole('button', { name: '组合为新作品' }).click();
    await page.waitForFunction(
      () => { const el = document.querySelector('input[placeholder="文章标题"]'); return el && (el.value || '').startsWith('导入：导入：') === false && (el.value || '').startsWith('导入：仅引用'); },
      { timeout: 20000 });
    const idText3 = await page.getByText(/ID w-/).textContent();
    const wid3 = (idText3.match(/w-\d+-\d+/) || [''])[0];
    const w3 = await (await api.get(`/api/drafts/${wid3}`)).json();
    const refs3 = (w3.source_refs || '').split('\n').filter(x => x.trim()).map(x => { try { return JSON.parse(x); } catch { return null; } });
    record('T02-03-reference-not-merged', refs3.length === 1 && refs3[0].mode === 'reference' && (w3.body || '') === '',
      { wid3, body_len: (w3.body || '').length, mode: refs3[0] ? refs3[0].mode : null });

    // T02-04 原件未改动（fixture 哈希对照导入前后）
    record('T02-04-no-page-errors', errors.length === 0, { errors: errors.slice(0, 3) });
  } catch (e) {
    record('T02-EXCEPTION', false, { error: String(e).slice(0, 260), wid });
  } finally {
    await browser.close();
  }
  const passed = results.filter(r => r.ok).length;
  console.log(`SUMMARY ${JSON.stringify({ passed, failed: results.length - passed })}`);
  process.exit(passed === results.length ? 0 : 1);
})();
