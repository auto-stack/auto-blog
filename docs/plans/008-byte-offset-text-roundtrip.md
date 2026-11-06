---
plan_id: BLOG-008
status: executing
feature_name: 当前SDK字节切片下的完整文本往返
author: [Codex]
created_at: 2026-11-06
updated_at: 2026-11-07
plan_revision: 3
current_step: 1
total_steps: 4
base_branch: main
base_commit: 3ead087723dff0ea36df4f9abb64a942a92beeb6
supersedes_spec_components: [docs/specs/blog/durable-drafts.md, docs/specs/blog/snapshots-export.md]
new_spec_components: []
touched_goals: []
---

# BLOG-008：当前SDK字节切片下的完整文本往返

## 0. 变更摘要

父auto-os/PLAN054最终SDK194实测作者保存/关闭/重开：磁盘title完整U054-Vue正式作者草稿54.25-r194，重新打开却得到U054-Vue正式作者草。只读原件完整；驱动在断言失败前没有继续保存截短值，不把该任务计为通过。根因作品元数据手写解析器以.length字符数限制现行find/slice字节偏移；当前SDK真实VM探针中文54.25的.len()=11、.length=7，用后者slice只得中文5。语言规范明确双计量，不能改语言或生成产物掩盖应用误用。

## 1. 目标与边界

中文/emoji及既有转义的标题/摘要/正文/元数据完整保存、重开、继续保存；相同字节索引类路径统一修复。稳定ID、revision、清单、迁移映射、发布签名与存储布局不变；不引入解析库或重写JSON协议。

## 2. 实施归属

唯一开发/复审目录D:/autostack/auto-blog，真实独立clone/main，用户应用规约优先；父组合只消费已审提交，不在apps编辑。进入时main3ead087干净，.next-id008；旁观旧Blog服务PID47236/17829及其C2映射程序不终止、不覆盖。正式clone构建使用父已存在独立Vue消费target c2e02416-vue-final-r187，隔离旧C2 exe。原src/pac及数据先核快照。无链接或重复开发树。

## 3. 依据与设计

已读durable-drafts/snapshots-export现行合同、works/drafts/api/publications/exporters实际文本路径及当前语言vm/overview的Str.len字节/.length字符区分。将与find/slice相配的字符串范围/游标长度改用.len()；逐函数审计，非盲目全局替换。保留迁移键长度前缀的旧字符计量，保留publications content_hash/probe_fold全部既有计量（发布签名不得漂移）；计量用于切片的路径统一字节。JSON首匹配、非法代理U+FFFD、迁移校验零副作用、恢复/条件写顺序保持。转义/解析算法不另行标准化。

### 规范增量

| delta_id | add/modify/retire | target | before/after rule | rationale | AC |
|---|---|---|---|---|---|
| SD01 | modify | docs/specs/blog/durable-drafts.md | 元数据解析/反转义/路径游标使用字节长度与find/slice一致；字符计量身份键保留；落实既有严格迁移JSON数字规则，整数段禁止前导0；字符串内未经转义的U+0000..001F必须在写入前拒绝 | 完整UTF8往返、零副作用拒绝及旧数据兼容 | AC01/02 |
| SD02 | modify | docs/specs/blog/snapshots-export.md | 现有文本切片边界按字节；既有content_hash和probe_fold输出不变 | 不截掉中文尾部且不重签旧发布 | AC01/02 |

## 4. 验证合同

| case/AC | owner_stage | 输入/实际入口 | 关闭条件 |
|---|---|---|---|
| V01/AC01 | work | 永久提取真实生产文本函数或完整模块→SDK194真实VM与实际生成Rust | 修复前UTF8反例真实红；修复后ASCII、中文、emoji、转义/代理、prettyJSON和字段后整数、Unicode目录尾分隔符完整，预期独立手写 |
| V02/AC02 | work | 正式独立Rust后端编译/实际HTTP create-save-open及读取前后文件比对；字节游标类逐项审计 | 中文标题/正文/ID/revision/时间戳不丢；旧迁移键及签名字符计量未改；原件未被读取破坏 |
| V03/AC03 | merge | 父054 SDK194 Vue/iced作者业务任务，旧数据重开与下一次有效保存 | 可见完整字段、实际卸载、独立磁盘/版本一致；不得仅API测试冒充UI |
| V04/AC04 | review/merge | 独立复审、准确Spec、main发布、组合消费和归档清理 | pending逐项保留，不冒称完成 |

## 5. 步骤与发布顺序

- [x] T00 owner_stage=work：冻结反例和全部同因字节游标/保留字符合同清单。
- [ ] T01 owner_stage=work：有界修复、永久反例/邻面、实际Rust编译/HTTP验证，提交工作完成。
- [ ] T02 owner_stage=review：同clone独立上下文复审源码/Spec/证据。
- [ ] T03 owner_stage=merge：通过独立源码/Spec及全部work后，先push具名已审源码阶段，父候选fetch/detach验证；随后父实际任务/规范/最终文档push/archive，源码等价Doc后继再更新父正式pin。阶段发布不代表最终交付通过；全部AC保留。

## 6. 记录

- stage:new | revision:r1 | outcome:pass→work | authorization:父054解决全部必要阻塞并完成原8app/双端的既有授权；属于原文本持久与重开合同修复，无新功能/预算/支持收窄。计划材料唯一具名父scope D:/autostack/plan-artifacts/plan-054/t07/blog-008，不另建撞号plan-008目录。SDK194 Langf032/UI1dba/Webc36/Man2a9/OSfa93；不改这些框架源码。

### r2 有界邻面修订

真实模块18用例先复现截断/错误路径/字段整数缺失；字节对齐后18/18。扩展到原迁移校验邻面时另发现已存在数字语法口：01/-01被scan_json_number当有效整数，违反durable-drafts原有严格数字校验规则。r2仅补整数段首0守卫，非新解析器或RFC支持扩张；零、负零、小数和指数邻面保留，原4任务/AC/布局不变。最初将空数组[]当普通JSON有效的测试预期不适用于该私有“批内需对象”门，改用[{}]空对象控制，不修改既有空批策略或把它列成产品缺陷。原source-map长度编码及发布签名三个函数体与3ead基线逐字节一致，未替换其5处字符长度；代码区共74处.length中其余69处为find/slice字节游标配对，审计清单在具名scratch，非字符串/注释盲替换。

新增守卫属于落实原严格迁移数字规则，SD01同时记录该既有拒绝规则；不改变有效存量文件格式、旧身份键或签名。永久真实模块/生产函数提取36/36实际VM通过，含中文/emoji/转义/代理、长字段后整数、Unicode键/路径、迁移键、嵌套JSON及坏数字控制。正式Rust/HTTP构建与独立复审仍待完成。

## 7. 待澄清

无新增用户语义决定。尚未实施/复审；原始Blog失败保留。父当前六项Vue任务成功不替Blog或最终Native任务。


- stage:work | revision:r2 | outcome:execution_done2/4 | code_commit:6bd7d3f5f0d652e689ba91f28ea4f8b091f99ae6 | next:independent same-clone source/Spec review
  Permanent tests/byte_text_roundtrip.py copies actual production works.at and extracts exact private production helpers with quote/comment-aware brace matching; actual frozenSDK194 VM executes independent expected values. Initial18-case real red returned truncated Unicode, wrong surrogate suffixes, missing fields/integers and duplicateUnicodepath separator (vm-red.log). Final36/36pass (vm-final-green.log): previous18 plus JSON object/nesting/invalid lexical guards, unchanged migration keys and unsupported empty-batch policy control. Prefix/body/identity semantics are checked, no copied replacement parser. DirectSource function bodies of migrate_key/content_hash/probe_fold are exactly3ead bytes, retaining five character-length operations; code-region audit classifies74 total occurrences,69 cursor operations converted. Audit SHA7e2da01d8f0de3d61b400e04cac3de9a2e9dce188802872080278380ae3a8d15.
  A first expanded32-case run honestly failed two expectations: private root gate rejects[] (empty migration is not regular JSON grammar acceptance) and genuine numeric01 acceptance contrary to original strict number rule. Corrected control to[{}] without changing empty policy; r2 adds only integer leadingzero guard with zero/-zero/fraction/exponent/malformedneighbors. No expected product failure relabelledgreen or old IDs/signatures changed. Current full36 actual bool/string/int types allchecked.
  Formal currentSDK clone service --server rust --dir D:/autostack/auto-blog -B18927 compiled release backend naturally (6m08s; legacy clone lock/config differs from prior candidate debug cache, no binary reused). CARGO_TARGET_DIR is existing producer-owned c2e02416-vue-final-r187, separate from foreign observer's C2/debug mappedexe. Langf032/UI1dba/Man2a9/Webc36/OSfa93 selected; sourceHEAD6bd held unchanged until actual service exited. Real HTTP create/open/conditional-save/open verifies full Chinese/emoji/quote/backslash title, multilinebody, longsummary/tags, stableID andpositivecreated_at; current/revision/body/metabytes agree. Read doesnot change committedbytes. Two actual invalid migration APIrequests (leadingzero andbad escape) return0 and allfilehashes unchanged, not positive zero-case acceptance. Receipt http-result.json SHA7645603e962043502f40b3e8e160107d66c04d719e6d42d50efce4f348465925.
  Captured service17140/Cargo11736/34788/backend7240/wrapper13644 all actualnormalexit0 after development shutdown202, allreaped/18927released; controlled_leaf_cancel=false. ForeignBlog47236 creation10:15:07 and C2/debugimage unchanged; no broadkill or OSinput. stop-result.json SHA57718c2cad21d51e7a3542fb637e2f42c3d45a169d391fb4ebdb663c8d8eb766. Readonly ownAPI/file tests donot replace parent Vue/native usertasks, parent sameSDK actualGUI reopen/nextsave stillpending. Actual published/generated/cargo/runtime root evidence remains external namedparent scratch, notGit.
  FinalVM log SHAea684849f2c78a733f3bdb283ffa68a3659f8925219e5c9208b5b24fff5f69e6; initialVM red SHA308592fd012322cb528c978e8f8bf205192c2e70070e5c9b0334b9210d33d13f; formalHTTP checklog SHA468838fb1a8d5e8e962dd57a09aba5bdace4ecf4bdbfb258c319fa4aca9027bb. SDK194 CLI909eb9c1d14f06fb42c805a0510f22c1b03e434f96cf0e4da3c456fb01824cbe. No source phasepush/OSpin/canonicalSpec/archive yet.


## 9. 独立复审记录

- stage: review | review_scope: final | reviewer_identity: independent Codex context /root/review_app_sdk; no implementation edits, model identity not exposed | plan_id:BLOG-008 | plan_revision:2 | outcome:needs_fix | worktree_path:D:/autostack/auto-blog | branch:main | reviewed_commit:cc118bd9548cf9304b0a76f7c507f532b0aed1de | source_commit:6bd7d3f5f0d652e689ba91f28ea4f8b091f99ae6 | base_commit:3ead087723dff0ea36df4f9abb64a942a92beeb6. Same real clone/single worktree verified; tracked checkout clean, implementation frozen. No source/Spec/push/pin/archive writes.
- dependency_revisions:SDK194 Lang f03226e10/UI 1dba/Web c36/Man 2a9/OS fa93, CLI SHA256 909eb9c1d14f06fb42c805a0510f22c1b03e434f96cf0e4da3c456fb01824cbe. spec_inputs:docs/specs/blog/durable-drafts.md SHA256 660f2c4a935deb32507a7f29b09b97721978ffecfd9a9288328ef694e111b7e9; docs/specs/blog/snapshots-export.md SHA256 fc20f46fb6c0919e0616e9cbdd484b8abd9617c5b7cf44dda46cc779e1469714. Frozen proposed SD01/SD02 block SHA256 5e464cb4d264ef1fcd4e52d711543619a0879e81633dbb5c707d09b1a03ae994. Empty goal/new-Spec lists justified by existing text/storage compatibility, no new goal identity.
- source/Spec scope: inspected full five-file source diff, cursor function bodies and 74-entry audit. Three identity/signature function bodies byte-identical to base (migrate_key/content_hash/probe_fold), all five character-count operations retained. Byte cursor boundaries align find/slice; b64 size uses byte count as current Spec requires, SHA guard retains the declared ASCII-hex domain. No format, ID, signature, first-match lookup, surrogate handling, commit/recovery ordering or API schema redesign. Proposed byte-offset/identity preservation text is appropriate. However SD01 strict-JSON rejection claim still fails F-BLOG-008-JSON-CONTROL below; Spec approval withheld pending repair.
- acceptance_results: AC01 partial — independent permanent production-module/private-helper VM replay exit0,36/36 with exact value/type assertions. Added independent cursor controls for Unicode array IDs→newline list→JSON, map_put same-key replacement and bare Unicode bearer suffix all pass; exponent0e-01 accepted,00.1 rejected. AC02 partial — original formal release service/HTTP create-open-save-open Unicode/summary/tags/ID/revision/timestamp/file preservation proof inspected; every recorded HTTP-data file hash independently matches. Strict malformed-string migration can still write, so this AC cannot pass. AC03 pending merge-owned actual parent Vue/iced/old-data-next-save tasks. AC04 review needs_fix; final Spec/main publication/pin/archive pending.
- native/formal provenance: run-clone-service.ps1 explicitly binds frozen SDK194 and producer roots, independent target c2e02416-vue-final-r187, owned data http-data,port18927. Exact entry `auto.exe service --server rust --dir D:/autostack/auto-blog -B 18927`; HTTP oracle `python D:/autostack/plan-artifacts/plan-054/t07/blog-008/verify-http.py`. Service log generated auto-blog-9876a458-back, cargo release build6m08, runtime PID7240; assembly consumer_fingerprint c22ca27bb799d3a0 agrees runtime ready. Generated native five modules inspected, retaining expected five chars().count() operations. Existing runtime exe SHA256 edcfdf744242a3b439ad06124774a91d8f3c0ab5b3a660bbf5b9f5e0134dc4e6. HTTP receipt SHA256 7645603e962043502f40b3e8e160107d66c04d719e6d42d50efce4f348465925; shutdown receipt57718c2cad21d51e7a3542fb637e2f42c3d45a169d391fb4ebdb663c8d8eb766 records owned normal exits0/reaped/port free, foreign observer unchanged. Reused valid formal checks; no Cargo/broad suite/service/observer actions by review.
- F-BLOG-008-JSON-CONTROL | P1 | AC01/AC02,T01 | existing contract failure in modified scan_json_string/json_array_valid: durable-drafts rule5 requires complete JSON validation and any violation rejected before all side effects. Raw unescaped U+000A LF, U+0009 TAB and U+0001 inside a JSON string each return true in actualSDK194 production helper. Escaped \n/\t plus Chinese/emoji remain valid. Source cause established: scan_json_string advances non-backslash/non-quote bytes without rejecting raw control characters. This is the same existing strict lexical admission contract as r2 leading-zero correction, not a new parser/support feature.
- production replay: copy current unmodified works.at/drafts.at into owned scratch, set AUTO_BLOG_DATA to fresh scratch/data, execute frozenSDK194 auto.exe probe.at which invokes drafts.migrate_articles_batch on `[{"slug":"raw-control-review","title":"bad<actual LF>raw","body":"完整中文😀尾部","author":"review"}]`. Expected return0 and zero files; observed return1 and11 created files (work/revision/current/high-water,index,journal,slug/source maps). Thus it reaches actual migration side effects, not merely an isolated validator disagreement.
- evidence: unique parent scope D:/autostack/plan-artifacts/plan-054/t07/blog-008/review; holdout-3r6d_5sn/result.json SHA256 f1dfaa7dae5b3e2bc5b242b516170b74ecc8de58cb026e815b0ec7358f8a4e94; migration-control-s92wkai5/result.json SHA256 d5032be5e42824bcec04dadbe50de1205b9c083e75f77565bd4769115888b1f1. Permanent VM replay `python tests/byte_text_roundtrip.py --auto D:/autostack/plan-artifacts/plan-054/t04/frozen-sdk-r194/auto.exe --scratch D:/autostack/plan-artifacts/plan-054/t07/blog-008/review` →36/36; raw result byte-text-7lmefm_g/result.json. Counterexample and accepted-control inputs/expected/observed above are durable for reconstruction.
- minimal closing oracle: reject representative raw U+0000..001F string controls before migration effects (whole-batch return0 and unchanged/absent files), retain legal escaped equivalents and actual Unicode text, earlier number controls,36 existing cases and new Unicode cursor controls. Cover actual production validator/entry with independent expectations; re-review affected lexical path and valid siblings, do not rerun unrelated full catalog. Work decides implementation, commits repair in same clone. T01 reopened/current_step1/4; T00 remains complete.
- pending_closeout_gates/next: work repair F-BLOG-008-JSON-CONTROL then independent affected re-review. T03 named reviewed-source push→candidate fetch→parent actual tasks→Spec/final docs/push/archive sequence is self-consistent and does not waive ACs, but this needs_fix blocks source-stage approval. Prior Notes/Calendar/Todo source passes unchanged.

### r3 复审修复诊断与当前验证

F-BLOG-008-JSON-CONTROL → 原严格迁移JSON不变量：任何字段/嵌套字符串的原始C0字符必须在全批任何写入前拒绝，合法转义及UTF8保持。唯一共同入口scan_json_string原来只处理引号/反斜杠，放过原始控制字符；新增非空单字节切片 < 空格的守卫，排除多字节内部返回空切片。没有重写转义/身份键/发布签名算法。r3只明确既有严格JSON规则及永久输入覆盖，原4任务/AC/支持范围不变。

永久tests/json_control_rejection.py复制完整真实works/drafts模块并调用migrate_articles_batch：32原始控制字符应全部return0且零文件，另合法转义LF/TAB和中文emoji迁移1并独立读取完整title/body。为防语言字符串源码不识别部分JSON式Unicode转义，输入以原始UTF8文件写入，再通过fs.read_text进入生产函数；相同入口也用于永久byte_text_roundtrip的69个独立预期，旧36及新增32原始控制+1合法转义全部通过。早期json.dumps直接嵌入语言源码的输入不能代表全部32原始字节，原日志保留但不计32控制证明；一次误用fs.read读到字节数组的失败已纠正为fs.read_text，不将其算产品失败。

准确file-fed测试在隔离scratch中以git show f973的未修改模块实际回放，exit1，32非法请求全部被迁移并落盘，证明原缺陷；当前修复版exit0，32拒绝且无任何文件，合法转义迁移1/title/body完整（c0/migration-c0-x7sc3vs9/result.json）。辅助69/69完整值及类型通过（c0/byte-text-4t7v20zz/result.json），旧三个身份/签名函数体仍与3ead逐字节一致。根scratch D:/autostack/plan-artifacts/plan-054/t07/blog-008。正式Rust/HTTP控制字符零写入验证、源码冻结复审仍pending；T01尚未完成。
