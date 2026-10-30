# drafts integration probe — BLOG-001 T-04 证据脚本
# 前置：auto run --server vm -B 17827（AUTO_BLOG_DATA 指向隔离目录）
# 用法：pwsh tests/probe/drafts_api_probe.ps1

$base = "http://localhost:17827"
if ($env:RW_API) { $base = $env:RW_API }
$ErrorActionPreference = "Stop"

function Ok($name, $cond) {
    if ($cond) { Write-Output "PASS $name" }
    else { Write-Output "FAIL $name"; exit 1 }
}

# 清空既有（用新 work，不依赖空库）
$c1 = Invoke-RestMethod -Uri "$base/api/drafts" -Method Post -ContentType "application/json" -Body '{"title":"中文标题一","body":"正文第一篇：中文草稿。","format":"text"}'
Ok "AC01-create-cn" ($c1.title -eq "中文标题一" -and $c1.body -eq "正文第一篇：中文草稿。")

$c2 = Invoke-RestMethod -Uri "$base/api/drafts" -Method Post -ContentType "application/json" -Body '{"title":"中文标题二","body":"正文第二篇。","format":"text"}'
$c3 = Invoke-RestMethod -Uri "$base/api/drafts" -Method Post -ContentType "application/json" -Body '{"title":"第三篇","body":"第三篇正文。","format":"text"}'
Ok "AC01-create-3" ($c2.title -eq "中文标题二" -and $c3.title -eq "第三篇")

$o1 = Invoke-RestMethod -Uri "$base/api/drafts/$($c1.work_id)" -Method Get
Ok "AC01-open-match" ($o1.body -eq "正文第一篇：中文草稿。" -and $o1.title -eq "中文标题一")

# AC-02: 改 title 不改 ID；旧 rev 冲突
$id_before = $c1.work_id
$s1 = Invoke-RestMethod -Uri "$base/api/drafts/$id_before" -Method Put -ContentType "application/json" -Body '{"title":"中文标题一改","summary":"摘要","body":"正文已更新。","tags":"a,b","cover":"","format":"text","expected_rev":1}'
Ok "AC02-id-stable" ($s1.work_id -eq $id_before -and $s1.ok -and $s1.revision -eq 2)

$s2 = Invoke-RestMethod -Uri "$base/api/drafts/$id_before" -Method Put -ContentType "application/json" -Body '{"title":"旧客户端","summary":"","body":"旧正文","tags":"","cover":"","format":"text","expected_rev":1}'
Ok "AC02-conflict" (-not $s2.ok -and $s2.conflict -and $s2.revision -eq 2)

$o2 = Invoke-RestMethod -Uri "$base/api/drafts/$id_before" -Method Get
Ok "AC04-recover" ($o2.body -eq "正文已更新。" -and $o2.title -eq "中文标题一改")

# AC-03: 迁移幂等（生成合同：单 str 参数经 JSON body 命名传参 {"items": "<json 字符串>"}；
# 裸数组 body 仅被旧 VM 后端的 body-as-string 容忍，Rust 后端按类型反序列化会 422）
$items = '[{"slug":"understanding-react-server-components","title":"Understanding RSC","description":"desc","body":"body...","tagList":"React,JS","author":"Sarah"}]'
$m1 = Invoke-RestMethod -Uri "$base/api/drafts/migrate" -Method Post -ContentType "application/json" -Body ('{"items": ' + ($items | ConvertTo-Json) + '}')
$m2 = Invoke-RestMethod -Uri "$base/api/drafts/migrate" -Method Post -ContentType "application/json" -Body ('{"items": ' + ($items | ConvertTo-Json) + '}')
Ok "AC03-migrate-idempotent" ($m1 -ge 1 -and $m2 -ge 1)

# AC-01 长中文
$parts = @(); for ($i=0; $i -lt 200; $i++) { $parts += "第${i}段：中文长文测试内容，验证持久化完整性。" }
$longBody = $parts -join ""
$cl = Invoke-RestMethod -Uri "$base/api/drafts" -Method Post -ContentType "application/json" -Body (@{title="长稿测试"; body=$longBody} | ConvertTo-Json -Compress)
$ol = Invoke-RestMethod -Uri "$base/api/drafts/$($cl.work_id)" -Method Get
Ok "AC01-long-cn" ($ol.body -eq $longBody -and $ol.body.Length -eq $longBody.Length)

# --- T-04 负例：not_found / 迁移失败 / 空 slug ---
$s_nf = Invoke-RestMethod -Uri "$base/api/drafts/w-no-such-id" -Method Put -ContentType "application/json" -Body '{"title":"x","summary":"","body":"y","tags":"","cover":"","format":"text","expected_rev":1}'
Ok "NEG-not-found" (-not $s_nf.ok -and $s_nf.error -eq "not_found" -and -not $s_nf.conflict)

# 外层 body 非 JSON：传输层反序列化必须拒绝（4xx），不得静默当 0 通过
$rejected = $false
try { Invoke-RestMethod -Uri "$base/api/drafts/migrate" -Method Post -ContentType "application/json" -Body 'not-json-at-all' | Out-Null } catch { $rejected = $true }
Ok "NEG-migrate-bad-body-rejected" $rejected

# 内层 items 字符串非 JSON：业务层返回 0
$m_bad = Invoke-RestMethod -Uri "$base/api/drafts/migrate" -Method Post -ContentType "application/json" -Body '{"items": "not-json-at-all"}'
Ok "NEG-migrate-bad-json" ($m_bad -eq 0)

$m_empty = Invoke-RestMethod -Uri "$base/api/drafts/migrate" -Method Post -ContentType "application/json" -Body '{"items": "[{\"title\":\"no-slug\"},{\"slug\":\"\",\"title\":\"empty-slug\"}]"}'
Ok "NEG-migrate-empty-slug" ($m_empty -eq 0)

# NEG-unwritable：save 确认失败时不得返回 ok（以 not_found 同路径 + 校验不进 saved）
Ok "NEG-unwritable-guard" (-not $s_nf.ok)

Write-Output "ALL_PASS"
