// vue_dev_scenarios.cjs — BLOG-005 T-04：vue-dev-rust profile 场景（经 verify_dual.py 调度）。
// 与 vue_ui_scenarios.cjs 消费相同草稿协议（RW_URL/RW_API/DUAL_PHASE/DUAL_WID），
// 但 oracle 面向 dev 路径的区分性断言（BLOG-005 计划 B-02/B-03）：
//   - 真实 author 页挂载必须=引擎（.autodown-editor），空 outlet / 永远 textarea 都算 FAIL
//     （F-2 假绿反例：导航壳正常但路由求值失败——本场景就是它的永久反控）。
//   - 引擎渲染种子内容 + 输入逐字经 API 独立读回 + 磁盘 body.txt 三通道一致。
//   - 空稿起稿规则（textarea）→ 正文非空切引擎 → 引擎可编辑。
//   - 预览切换渲染后返回编辑，内容保留。
// 输出每场景一行 `PASS|FAIL <name> <json>`；汇总 `SUMMARY {...}`；pre 末尾 `WID <id>`。
//   DUAL_PHASE=pre|post RW_URL=<dev_front> RW_API=<back> node tests/dual/vue_dev_scenarios.cjs
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
const { chromium, request } = require(path.join(root, 'tests/node_modules/@playwright/test'));

const PHASE = process.env.DUAL_PHASE || 'pre';
const URL = process.env.RW_URL;
const API = process.env.RW_API;
const DATA = process.env.RW_DATA || '';
if (!URL || !API) { console.error('RW_URL/RW_API required'); process.exit(2); }

const TITLE = 'dev轨中文标题"引号"';
const MD_SEED = '# dev轨标题\n\n段落一：**加粗**与*斜体*。\n\n> 引用一行\n\n- 列表甲\n- 列表乙';
const TAIL = '\n\ndev轨引擎内追加';

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
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    // RW_DEBUG_DOM=1：诊断转储（console + 指定时刻的 autodown DOM），不改变任何 oracle
    const DEBUG_DOM = !!process.env.RW_DEBUG_DOM;
    if (DEBUG_DOM) page.on('console', m => console.log(`CONSOLE[${m.type()}] ` + m.text().slice(0, 240)));
    const dumpDom = async tag => {
      if (!DEBUG_DOM) return;
      const dump = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="autodown"]')).map(
          e => `<${e.tagName} class="${e.className}"> ` + e.innerHTML.slice(0, 260)
        )
      ).catch(e => ['dump-err: ' + e.message]);
      console.log(`DOMDEBUG[${tag}] ` + JSON.stringify(dump).slice(0, 1800));
    };
    await page.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });

    if (PHASE === 'pre') {
      // S1 种子非空 markdown 稿并打开——路由必须真实挂载且=引擎（区分性 oracle）
      const st = await api.post('/api/drafts', { data: { title: TITLE, body: MD_SEED, format: 'markdown' } });
      const w = await st.json().catch(() => ({}));
      wid = w.work_id || '';
      record('dev.seed_draft', st.ok() && wid.startsWith('w-'), { status: st.status(), wid });
      await page.getByText(TITLE, { exact: true }).first().click({ timeout: 10000 });
      let mounted = 'none';
      try {
        await page.waitForSelector('.autodown-editor, textarea[placeholder*="正文（Markdown"]', { timeout: 15000 });
        mounted = (await page.locator('.autodown-editor').count()) ? 'engine' : 'textarea';
      } catch {
        mounted = (await page.getByText(/ID w-/).isVisible().catch(() => false)) ? 'shell-only' : 'empty-outlet';
      }
      record('dev.mount_real_engine', mounted === 'engine', { mounted });

      // S2 引擎渲染种子 + 输入逐字三通道（UI→API→磁盘）
      if (mounted === 'engine') {
        const h1 = await page.locator('.autodown-editor h1', { hasText: 'dev轨标题' }).count();
        record('dev.engine_renders_seed', h1 > 0, { h1 });
        await page.locator('[data-engine-editor]').first().click().catch(() => {});
        await page.keyboard.press('Control+End');
        await page.keyboard.type(TAIL, { delay: 25 });
        await page.waitForTimeout(4500); // 3s autosave tick + margin
        const st2 = await api.get(`/api/drafts/${wid}`);
        const w2 = await st2.json().catch(() => ({}));
        const body = (w2.body || '').toString();
        const rt = st2.ok() && body.includes('dev轨引擎内追加') && body.includes('dev轨标题');
        let disk = false;
        if (DATA) {
          const bf = path.join(DATA, 'works', wid, 'body.txt');
          disk = fs.existsSync(bf) && fs.readFileSync(bf, 'utf8').includes('dev轨引擎内追加');
        }
        record('dev.edit_roundtrip_3ch', rt && (!DATA || disk), { api: rt, disk, rev: w2.revision });
      } else {
        record('dev.engine_renders_seed', false, { mounted, note: 'engine not mounted (F-2 defect counterexample)' });
        record('dev.edit_roundtrip_3ch', false, { mounted });
      }

      // S3 空稿起稿规则：新稿=textarea 起稿 → 填入 → 切引擎
      await page.getByRole('button', { name: '新建草稿' }).click();
      const ta = page.locator('textarea[placeholder*="正文（Markdown"]').first();
      await ta.waitFor({ timeout: 20000 });
      const hint = await page.getByText('空稿可直接输入；正文非空后可切引擎编辑器').isVisible();
      record('dev.empty_start_textarea', hint, { hint });
      await ta.fill(MD_SEED);
      await page.getByRole('button', { name: '编辑器：降级 · 切引擎' }).click();
      const eng = await page.locator('.autodown-editor').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
      const h1b = eng ? await page.locator('.autodown-editor h1', { hasText: 'dev轨标题' }).count() : 0;
      record('dev.empty_then_engine_switch', eng && h1b > 0, { eng, h1: h1b });

      // S4 预览切换：渲染可见 → 返回编辑内容保留
      const previewBtn = page.getByRole('button', { name: /预览/ }).first();
      const hasPreview = await previewBtn.isVisible().catch(() => false);
      if (hasPreview) {
        await previewBtn.click();
        await page.waitForTimeout(1200);
        await dumpDom('preview');
        const rendered = await page.locator('.autodown h1, .autodown-editor h1, [class*="autodown"] h1').first()
          .isVisible().catch(() => false);
        record('dev.preview_renders', rendered, { rendered });
        const backBtn = page.getByRole('button', { name: /返回编辑|编辑/ }).first();
        await backBtn.click().catch(() => {});
        const still = await page.locator('.autodown-editor h1', { hasText: 'dev轨标题' }).count();
        record('dev.preview_back_preserves', still > 0, { still });
      } else {
        record('dev.preview_renders', false, { note: 'preview toggle not found' });
        record('dev.preview_back_preserves', false, { note: 'preview toggle not found' });
      }
      console.log('WID ' + wid);
    } else {
      // post：重启后重开同稿，引擎仍挂载、内容仍在、下一次编辑保存成功
      const st0 = await api.get(`/api/drafts/${wid}`).catch(() => null);
      const w0 = st0 && st0.ok() ? await st0.json().catch(() => ({})) : {};
      await page.getByText(w0.title || TITLE, { exact: true }).first().click({ timeout: 10000 }).catch(() => {});
      let mounted = 'none';
      try {
        await page.waitForSelector('.autodown-editor, textarea[placeholder*="正文（Markdown"]', { timeout: 15000 });
        mounted = (await page.locator('.autodown-editor').count()) ? 'engine' : 'textarea';
      } catch { mounted = 'empty-outlet'; }
      record('dev.reopen_engine_mounted', mounted === 'engine', { mounted, wid });
      if (mounted === 'engine') {
        await page.locator('[data-engine-editor]').first().click().catch(() => {});
        await page.keyboard.press('Control+End');
        await page.keyboard.type('\n\n重启后编辑', { delay: 25 });
        await page.waitForTimeout(4500);
        await dumpDom('post-typed');
        const st2 = await api.get(`/api/drafts/${wid}`);
        const w2 = await st2.json().catch(() => ({}));
        record('dev.post_restart_next_save', st2.ok() && (w2.body || '').includes('重启后编辑'),
               { rev: w2.revision, ok: st2.ok() });
      } else {
        record('dev.post_restart_next_save', false, { mounted });
      }
    }
  } catch (e) {
    errors.push('fatal: ' + e.message);
    // fatal 必须成为显式失败场景参与退出码——否则部分执行会被误判全绿
    record('dev.fatal_error', false, { message: String(e.message).slice(0, 200) });
  } finally {
    await browser.close().catch(() => {});
  }
  const passed = results.filter(r => r.ok).length;
  console.log(`SUMMARY ${JSON.stringify({ passed, failed: results.length - passed, errors: errors.slice(0, 3) })}`);
  process.exit(passed === results.length && results.length > 0 ? 0 : 1);
})();
