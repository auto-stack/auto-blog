// vue_ui_scenarios.cjs — BLOG-004 T-05：Vue＋Rust 真实交互场景（经 verify_dual.py 调度）。
// 真实浏览器输入/点击到达 Vue 组件与 draft store，再落真实 Rust 后端；
// 独立 HTTP 读回对照（非仅 UI 自证）。用法：
//   DUAL_PHASE=pre|post RW_URL=<front> RW_API=<back> [DUAL_WID=<id>] node tests/dual/vue_ui_scenarios.cjs
// 输出每场景一行 `PASS|FAIL <name> <json detail>`；汇总行 `SUMMARY {"passed":n,"failed":m}`。
// 注意：3s 自动保存 tick 与手动保存可能双写，输方进入 conflict（expected_rev 过期）——
// 每个编辑步骤前先 settle（等 tick 过去、出现冲突则「保留本机版本」恢复到 saved），
// 专用冲突场景在 settle 之后人为制造，保证确定性。
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium, request } = require(path.join(root, 'tests/node_modules/@playwright/test'));

const PHASE = process.env.DUAL_PHASE || 'pre';
const URL = process.env.RW_URL;
const API = process.env.RW_API;
if (!URL || !API) { console.error('RW_URL/RW_API required'); process.exit(2); }

const TITLE = '中文标题"引号"';
const BODY_V1 = '正文第一段：真实UI输入。\n正文第二段：换行保留。';
const BODY_V2 = '自动保存追加的段落：3秒tick应将其持久化。';
const TITLE_V2 = '改后的标题——手动保存';
const BODY_V3 = 'UI 本机新输入——冲突期间不得丢失';
const TITLE_BOX = '文章标题';
const BODY_BOX = '正文（支持中文、长稿；自动保存）';

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
}

(async () => {
  const api = await request.newContext({ baseURL: API });
  const browser = await chromium.launch({ headless: true });
  const shot = (page, name) => page.screenshot({ path: path.join(root, '.tmp/dual', `vue-ui-${PHASE}-${name}.png`), fullPage: true });
  try {
    const page = await browser.newPage();
    page.on('requestfailed', r => { if (r.url().includes('/api/')) console.log('NETFAIL ' + r.method() + ' ' + r.url() + ' :: ' + ((r.failure() || {}).errorText || '?')); });
    page.on('response', r => { if (r.url().includes('/api/')) console.log('NET ' + r.request().method() + ' ' + r.url() + ' -> ' + r.status()); });
    await page.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByText('我的草稿', { exact: true }).waitFor({ timeout: 30000 });

    // tick 过去 + 冲突恢复，回到 saved 稳态
    const settle = async () => {
      await page.waitForTimeout(3500);
      if (await page.getByText(/保存冲突：/).isVisible().catch(() => false)) {
        await page.getByRole('button', { name: '保留本机版本' }).click();
        await page.getByText('● 已保存').waitFor({ timeout: 15000 });
      }
    };

    if (PHASE === 'pre') {
      // 1) 新建草稿：真实输入 中文/引号/换行，手动保存（wait 编辑器出现=采纳完成，
      //    避开「创建等待期编辑→放弃采纳」的 R-23 竞态）
      await page.getByRole('button', { name: '新建草稿' }).click();
      const titleInput = page.getByPlaceholder(TITLE_BOX);
      const bodyBox = page.getByPlaceholder(BODY_BOX);
      await titleInput.waitFor({ timeout: 15000 });
      await titleInput.fill(TITLE);
      await bodyBox.fill(BODY_V1);
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await page.getByText('● 已保存').waitFor({ timeout: 15000 });
      const idLine = await page.getByText(/ID w-.* · rev/).innerText();
      const m = idLine.match(/ID (w-\S+) · rev (\d+)/);
      record('ui.new_draft_hard_input', !!m, { idLine });
      if (!m) throw new Error('no work id line');
      const wid = m[1];
      await settle();
      await shot(page, 'new-draft');

      // 2) 自动保存：编辑后不点保存，等 3s tick 落盘（T-05 发现：Vue 渲染 author 页
      //    onMounted 未运行→timer 未注册，tick 永不触发；手动调 store.AutosaveTick()
      //    立即 PUT 正常——缺陷在 auto-ui Vue 渲染器接线层，Blog 侧不越仓修补）
      await bodyBox.fill(BODY_V1 + '\n' + BODY_V2);
      await page.getByText('● 未保存').waitFor({ timeout: 5000 });
      let autoOk = false, autoDetail = {};
      try {
        await page.getByText('● 已保存').waitFor({ timeout: 10000 });
        const back1 = await (await api.get('/api/drafts/' + wid)).json();
        autoOk = back1.body === BODY_V1 + '\n' + BODY_V2;
        autoDetail = { wid, rev: back1.revision, tickSaved: true };
      } catch {
        autoDetail = { wid, tickSaved: false, note: '15s 内零 tick PUT；手动 AutosaveTick 调用立即 PUT（探针证据）' };
      }
      record('ui.autosave_3s', autoOk, autoDetail);
      if (!autoOk) {
        // 收敛状态：手动保存，避免污染后续读回断言（自动保存缺陷另记）
        await page.getByRole('button', { name: '保存', exact: true }).click();
        await page.getByText('● 已保存').waitFor({ timeout: 15000 });
      }
      await settle();
      await shot(page, 'autosave');

      // 3) 独立 HTTP 读回：同 work_id，数据与 UI 一致
      const back2 = await (await api.get('/api/drafts/' + wid)).json();
      const rbOk = back2.title === TITLE && back2.body === (await bodyBox.inputValue());
      record('ui.independent_http_readback', rbOk, { wid, rev: back2.revision, titleMatch: back2.title === TITLE });
      if (!rbOk) await shot(page, 'readback-mismatch');

      // 4) 改标题 + 手动保存（V-02：改标题）
      await titleInput.fill(TITLE_V2);
      await page.getByRole('button', { name: '保存', exact: true }).click();
      await page.getByText('● 已保存').waitFor({ timeout: 15000 });
      const back3 = await (await api.get('/api/drafts/' + wid)).json();
      record('ui.title_change_saved', back3.title === TITLE_V2, { wid, rev: back3.revision, title: back3.title });
      await settle();
      await shot(page, 'title-change');

      // 5) 可见冲突：外部客户端以当前 rev 抢写成功 → UI 保存必须显示冲突而非已保存
      const uiRev = parseInt((await page.getByText(/ID w-.* · rev/).innerText()).match(/rev (\d+)/)[1], 10);
      const steal = await (await api.put('/api/drafts/' + wid, { data: {
        title: '外部抢写版本', summary: '', body: '另一客户端在UI保存前写入', tags: '', expected_rev: uiRev,
      } })).json();
      if (!steal.ok) throw new Error('setup: external write failed ' + JSON.stringify(steal));
      await bodyBox.fill(BODY_V3);
      await page.getByRole('button', { name: '保存', exact: true }).click();
      let conflictShown = false;
      try { await page.getByText(/保存冲突：/).waitFor({ timeout: 8000 }); conflictShown = true; } catch {}
      const savedNotShown = !(await page.getByText('● 已保存').isVisible().catch(() => false));
      record('ui.conflict_visible', conflictShown && savedNotShown, { conflictShown, savedNotShown, uiRev });
      await shot(page, 'conflict');

      // 6) 冲突恢复：保留本机版本 → 已保存 → 后端为 UI 内容
      await page.getByRole('button', { name: '保留本机版本' }).click();
      await page.getByText('● 已保存').waitFor({ timeout: 15000 });
      const back4 = await (await api.get('/api/drafts/' + wid)).json();
      record('ui.conflict_keepmine_recover', back4.body === BODY_V3, { rev: back4.revision, bodyMatch: back4.body === BODY_V3 });
      await settle();
      await shot(page, 'keepmine');

      // 7) 页面刷新：已确认数据不丢（重开）。mounted 钩子若未运行（见 autosave 场景注），
      //    LoadList 不执行→列表空→重开不可达——此时按同根因记失败。
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText('我的草稿', { exact: true }).waitFor({ timeout: 30000 });
      let reopenOk = false, reopenDetail = {};
      try {
        await page.getByText(TITLE_V2, { exact: true }).click({ timeout: 8000 });
        const box = page.getByPlaceholder(BODY_BOX);
        await box.waitFor({ timeout: 15000 });
        const reopened = await box.inputValue();
        reopenOk = reopened === BODY_V3;
        reopenDetail = { len: reopened.length };
      } catch (e) {
        reopenDetail = { note: '刷新后列表不可达/重开失败（同根因：页面 mounted 钩子未运行，LoadList 不执行）', err: String(e).slice(0, 120) };
      }
      record('ui.refresh_reopen_persists', reopenOk, reopenDetail);
      await shot(page, 'refresh-reopen');

      console.log('WID ' + wid);
    } else {
      // post：后端重启后重开——已确认数据不丢（同刷新场景：mounted 死则列表空，具名失败）
      const wid = process.env.DUAL_WID;
      let ok = false, detail = {};
      try {
        await page.getByText(TITLE_V2, { exact: true }).first().click({ timeout: 8000 });
        const box = page.getByPlaceholder(BODY_BOX);
        await box.waitFor({ timeout: 15000 });
        const body = await box.inputValue();
        const idLine = await page.getByText(/ID w-.* · rev/).innerText();
        ok = body === BODY_V3 && idLine.includes(wid);
        detail = { wid, idLine, bodyMatch: body === BODY_V3 };
      } catch (e) {
        detail = { wid, note: '重启后列表不可达/重开失败（同根因：mounted 钩子未运行）', err: String(e).slice(0, 120) };
      }
      record('ui.restart_backend_persists', ok, detail);
      await shot(page, 'restart-reopen');
    }
  } catch (e) {
    record('ui.fatal', false, { error: String(e).slice(0, 300) });
  } finally {
    await browser.close();
    await api.dispose();
  }
  const failed = results.filter(r => !r.ok).length;
  console.log(`SUMMARY ${JSON.stringify({ passed: results.length - failed, failed })}`);
  process.exit(failed ? 1 : 0);
})();
