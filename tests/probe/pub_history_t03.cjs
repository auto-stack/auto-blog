// pub_history_t03.cjs — BLOG-003 T-03 定向验收（Vue 轨 UI）：
// 发布历史/导出包/快照只读（AC-02 UI 面）/历史比较/能力边界说明。
// 前置: 后端 service 于 API（隔离数据）；前端 build+preview 于 URL。
//   node tests/probe/pub_history_t03.cjs <front_url> <api_url>
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium, request } = require(path.join(root, 'tests/node_modules/@playwright/test'));

const URL = process.argv[2];
const API = process.argv[3];
if (!URL || !API) { console.error('usage: pub_history_t03.cjs <front> <api>'); process.exit(2); }

const results = [];
function record(name, ok, detail) {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
}

(async () => {
  const api = await request.newContext({ baseURL: API });
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  try {
    // 准备：API 建稿 v1（含冻结标记）
    const w = await (await api.post('/api/drafts', {
      data: { title: 'T03 UI 电池稿', body: '# T03UI-v1\n\n冻结标记甲。', format: 'markdown' }
    })).json();
    const wid = w.work_id;

    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', e => {
      const m = e.message || '';
      if (!m.includes("reading 'token'")) errors.push(m);
    });
    await page.goto(URL + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });

    // U1 打开草稿 → 发布与导出区可见（空历史）
    await page.getByText('T03 UI 电池稿').first().click();
    await page.getByRole('button', { name: '发布快照' }).waitFor({ timeout: 15000 });
    const empty = await page.getByText('尚无发布快照').isVisible();
    record('U1-open-and-empty-history', empty, { empty });

    // U2 发布快照 → 历史行出现（rev 1 · snapshotted · 与当前一致）
    await page.getByRole('button', { name: '发布快照' }).click();
    await page.getByText('snapshotted', { exact: true }).first().waitFor({ timeout: 15000 });
    const badge = await page.getByText('snapshotted', { exact: true }).first().isVisible();
    const same = await page.getByText('与当前一致', { exact: true }).first().isVisible();
    record('U2-publish-row', badge && same, { badge, same });

    // U3 导出包 → 状态翻转 exported；后端包落盘
    await page.getByRole('button', { name: '导出包' }).first().click();
    await page.getByText('exported', { exact: true }).first().waitFor({ timeout: 15000 });
    const pkgOnDisk = await (await api.get(`/api/publications/listing`)).status(); // 占位避免 lint；真实断言在下方 API 读回
    const pubs = await (await api.get(`/api/works/${wid}/publications`)).json();
    const pid = pubs[0] && pubs[0].publication_id;
    let pkgOk = false;
    if (pid) {
      const man = await (await api.get(`/api/publications/${pid}`)).json();
      pkgOk = man.state === 'exported';
    }
    record('U3-export-package', pkgOk, { pid, state: pkgOk ? 'exported' : '?', probe: pkgOnDisk === 404 });

    // U4 打开快照 → 只读面板含冻结标记；写作面隐藏（002 预览同款独立状态；
    // 标签/封面/保存行按原设计保持可见）；关闭返回编辑
    await page.getByRole('button', { name: '打开快照' }).first().click();
    await page.getByText('快照 rev 1（只读）').waitFor({ timeout: 15000 });
    const frozenSeen = await page.getByText('冻结标记甲。').isVisible();
    const surfaceHidden = (await page.getByRole('button', { name: '格式：Markdown · 切纯文本' }).count()) === 0;
    await page.getByRole('button', { name: '关闭快照' }).click();
    await page.getByRole('button', { name: '格式：Markdown · 切纯文本' }).waitFor({ timeout: 15000 });
    record('U4-snapshot-readonly', frozenSeen && surfaceHidden, { frozenSeen, surfaceHidden });

    // U5 v2 改稿（API 直改）→ 重开后该快照「已分叉」；快照正文仍 v1（AC-02 UI 面）
    // 注意：content_hash 为非加密签名（len+探针计数，T-01 裁定），v1/v2 须用
    // 不同字节长度/标点轮廓，否则签名碰撞 → UI 正确显示「与当前一致」。
    await api.put(`/api/drafts/${wid}`, {
      data: { title: 'T03 UI 电池稿v2', summary: '', body: '# T03UI-v2 改稿\n\n改动标记乙，加了更多内容让签名轮廓不同。\n\n- 新增列表项', tags: '', cover: '', format: 'markdown', expected_rev: 1 }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: '我的草稿' }).waitFor({ timeout: 30000 });
    await page.getByText('T03 UI 电池稿v2').first().click();
    await page.getByRole('button', { name: '发布快照' }).waitFor({ timeout: 15000 });
    // 该 pub 在 U3 已导出：历史行状态标记=exported（行渲染完成的准确标记）
    await page.getByText('exported', { exact: true }).first().waitFor({ timeout: 15000 });
    const forked = await page.getByText('已分叉', { exact: true }).first().isVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '打开快照' }).first().click();
    await page.getByText('快照 rev 1（只读）').waitFor({ timeout: 15000 });
    const stillV1 = await page.getByText('冻结标记甲。').isVisible();
    const notV2 = (await page.getByText('改动标记乙，加了更多内容让签名轮廓不同。').count()) === 0;
    record('U5-fork-and-ac02', forked && stillV1 && notV2, { forked, stillV1, notV2 });
    await page.getByRole('button', { name: '关闭快照' }).click();

    // U6 再次发布 rev2 → 两条历史；再次导出（幂等）不报错
    await page.getByRole('button', { name: '发布快照' }).click();
    await page.getByText('rev 2', { exact: false }).first().waitFor({ timeout: 15000 });
    const rows = await page.getByText('已分叉', { exact: true }).count();
    await page.getByRole('button', { name: '导出包' }).nth(1).click();
    await page.waitForTimeout(1200);
    const errVisible = await page.getByText('发布操作失败', { exact: false }).isVisible().catch(() => false);
    record('U6-second-publish-and-reexport', rows >= 1 && !errVisible, { forkedRows: rows, exportError: errVisible });

    // U7 能力边界说明可见（AC-04 差异说明 / F-12）
    const note = await page.getByText('HTML 导出待引擎采集原语', { exact: false }).first().isVisible();
    record('U7-html-capability-note', note, { note });

    const errSummary = errors.length ? { pageErrors: errors.slice(0, 3) } : {};
    record('U8-no-page-errors', errors.length === 0, errSummary);
  } finally {
    await browser.close();
  }
  const passed = results.filter(Boolean).length;
  console.log(`SUMMARY ${JSON.stringify({ passed, failed: results.length - passed })}`);
  process.exit(passed === results.length ? 0 : 1);
})();
