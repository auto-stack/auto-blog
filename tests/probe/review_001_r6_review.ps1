# review_001_r6_review.ps1 — BLOG-001 revision 6 最终复审独立反例（R-28/R-29 关闭判据）。
# RV1/RV2：迁移输入字段类型校验（R-27 修复文本「类型校验…无效输入明确拒绝且不写」）。
# RV7：迁移键含引号时的重跑幂等（AC-03/R-26；必须跨调用同 ID，且映射不得追加重复键）。
# RV4/RV5/RV6：恢复协议边界回归守卫（截断 meta/坏高水位/坏 .ok 标记）。
param([string]$Base='http://localhost:17837',[Parameter(Mandatory=$true)][string]$DataRoot)
$ErrorActionPreference='Continue'
$resolved=[IO.Path]::GetFullPath($DataRoot);$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if(-not $resolved.StartsWith((Join-Path $root '.tmp')+[IO.Path]::DirectorySeparatorChar)){throw 'Use isolated workspace .tmp data'}
$script:failed=0
function Api($method,$path,$data){$a=@{Uri="$Base/api/drafts$path";Method=$method;TimeoutSec=60};if($null-ne$data){$a.ContentType='application/json; charset=utf-8';$a.Body=[Text.Encoding]::UTF8.GetBytes(($data|ConvertTo-Json -Compress -Depth 10))};Invoke-RestMethod @a}
function Check($name,$ok,$detail){if($ok){"PASS $name $detail"}else{"FAIL $name $detail";$script:failed++}}
$dir=$resolved

# RV-1 数字 body → 拒绝且零副作用
$s='r6-typed-num';$items='[{"slug":"'+$s+'","title":"T","body":123}]'
$count=Api Post '/migrate' @{items=$items}
$sid=(Get-Content -Raw (Join-Path $dir 'slug-map.json')|ConvertFrom-Json).$s
$wid=(Get-Content -Raw (Join-Path $dir 'source-map.json')|ConvertFrom-Json).("_::"+$s)
Check 'RV1_TYPED_NUMBER_REJECTED' (($count-eq0)-and(-not$sid)-and(-not$wid)) "count=$count slug_map=$sid source_map=$wid"

# RV-2 数组 tagList → 拒绝且零副作用
$s='r6-typed-arr';$items='[{"slug":"'+$s+'","title":"T","body":"B","tagList":["x","y"]}]'
$count=Api Post '/migrate' @{items=$items}
$wid=(Get-Content -Raw (Join-Path $dir 'source-map.json')|ConvertFrom-Json).("_::"+$s)
Check 'RV2_TYPED_ARRAY_REJECTED' (($count-eq0)-and(-not$wid)) "count=$count source_map=$wid"

# RV-3 字符串字段合法控制
$s='r6-typed-ok';$items='[{"slug":"'+$s+'","title":"标题","body":"正文"}]'
$count=Api Post '/migrate' @{items=$items}
$id=(Get-Content -Raw (Join-Path $dir 'slug-map.json')|ConvertFrom-Json).$s
$o=Api Get "/$id"
Check 'RV3_TYPED_STRING_CONTROL' (($count-eq1)-and($o.body-eq'正文')) "count=$count body=$($o.body)"

# RV-4 指针目标 meta 截断 → 可见异常
$c=Api Post '' @{title='r6恢复';body='原始'};$wdir=Join-Path $dir "works/$($c.work_id)"
$s=Api Put "/$($c.work_id)" @{title='r6第二版';body='最新';summary='';tags='';expected_rev=1}
$ptr=Join-Path $wdir 'current.txt';$snap=@{}
foreach($n in @('current.txt','revisions/rev-2.json')){$snap[$n]=[IO.File]::ReadAllText((Join-Path $wdir $n))}
try{
 [IO.File]::WriteAllText((Join-Path $wdir 'revisions/rev-2.json'),'{"work_id":"',[Text.UTF8Encoding]::new($false))
 $o=Api Get "/$($c.work_id)"
 Check 'RV4_META_TRUNCATED_VISIBLE_ERROR' ($o.work_id-eq'') "id=$($o.work_id) rev=$($o.revision)"
}finally{foreach($n in $snap.Keys){[IO.File]::WriteAllText((Join-Path $wdir $n),$snap[$n])}}

# RV-5 高水位损坏 + 空指针 → 动态边界扫描仍恢复最高确认版
try{
 [IO.File]::WriteAllText((Join-Path $wdir 'high-water.txt'),'garbage')
 [IO.File]::WriteAllText($ptr,'')
 $o=Api Get "/$($c.work_id)"
 Check 'RV5_HW_CORRUPT_GAP_SCAN' (($o.revision-eq2)-and($o.body-eq'最新')) "rev=$($o.revision) body=$($o.body)"
}finally{[IO.File]::WriteAllText($ptr,$snap['current.txt']);Remove-Item (Join-Path $wdir 'high-water.txt') -ErrorAction SilentlyContinue}

# RV-6 纯文本 .ok 与 revision 不符 → 不可作为提交
try{
 [IO.File]::WriteAllText((Join-Path $wdir 'revisions/rev-2.ok'),'999')
 [IO.File]::WriteAllText($ptr,'2')
 $o=Api Get "/$($c.work_id)"
 Check 'RV6_PLAIN_OK_MISMATCH_REJECTED' ($o.work_id-eq'') "id=$($o.work_id) rev=$($o.revision)"
}finally{[IO.File]::WriteAllText((Join-Path $wdir 'revisions/rev-2.ok'),'2');[IO.File]::WriteAllText($ptr,$snap['current.txt'])}

# RV-7 引号 slug 迁移幂等：跨调用同 ID 且映射无重复键
$sj='r6-q\"uote-x'
$items='[{"slug":"'+$sj+'","title":"Q","body":"B"}]'
$count1=Api Post '/migrate' @{items=$items}
$id1=(Get-Content -Raw (Join-Path $dir 'source-map.json')|ConvertFrom-Json).("_::"+('r6-q"uote-x'))
$count2=Api Post '/migrate' @{items=$items}
$id2=(Get-Content -Raw (Join-Path $dir 'source-map.json')|ConvertFrom-Json).("_::"+('r6-q"uote-x'))
# 映射重复键检查：原始文本中同一转义键出现的次数必须为 1
$raw=Get-Content -Raw (Join-Path $dir 'source-map.json')
$needle='"_::r6-q\"uote-x":'
$dups=([regex]::Matches($raw,[regex]::Escape($needle))).Count
Check 'RV7_QUOTED_SLUG_IDEMPOTENT' (($count1-eq1)-and($count2-eq1)-and($id1-eq$id2)-and($dups-eq1)) "first=$count1 second=$count2 same_id=$($id1-eq$id2) key_dups=$dups"

if($script:failed){exit 1}else{Write-Host 'REVIEW_R6_PROBE_ALL_PASS';exit 0}
