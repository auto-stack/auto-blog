param([Parameter(Mandatory=$true)][string]$DataRoot,[string]$Base='http://localhost:17837')
$ErrorActionPreference='Stop'
$resolved=[IO.Path]::GetFullPath($DataRoot)
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not $resolved.StartsWith((Join-Path $root '.tmp')+[IO.Path]::DirectorySeparatorChar)) {throw 'Use isolated workspace .tmp data'}
$script:failed=0
function Api($method,$path,$data) {
 $a=@{Uri="$Base/api/drafts$path";Method=$method;TimeoutSec=30}
 if ($null -ne $data) {$a.ContentType='application/json; charset=utf-8';$a.Body=[Text.Encoding]::UTF8.GetBytes(($data|ConvertTo-Json -Compress -Depth 10))}
 Invoke-RestMethod @a
}
function Check($name,$ok,$detail) {if($ok){"PASS $name $detail"}else{"FAIL $name $detail";$script:failed++}}
$c=Api Post '' @{title='已确认旧版本';body='旧正文'}
$dir=Join-Path $resolved "works/$($c.work_id)"
$locks=@()
try {
 foreach($name in @('meta.json','body.txt')){$locks+=[IO.File]::Open((Join-Path $dir $name),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)}
 $s=Api Put "/$($c.work_id)" @{title='已确认新版本';body='新正文';summary='';tags='';expected_rev=1}
 $o=Api Get "/$($c.work_id)" $null
 Check 'REVISION_SAVE' ($s.ok -and $o.body -eq '新正文') "ok=$($s.ok) rev=$($o.revision) body=$($o.body)"
} finally {foreach($l in $locks){$l.Dispose()}}
# Simulate process loss immediately after truncating the mutable commit pointer.
$ptr=Join-Path $dir 'current.txt';$pointer=[IO.File]::ReadAllText($ptr)
try {
 [IO.File]::WriteAllText($ptr,'')
 $o=Api Get "/$($c.work_id)" $null
 Check 'TORN_POINTER_RECOVERY' ($o.body -eq '新正文' -and $o.revision -eq 2) "rev=$($o.revision) body=$($o.body)"
} finally {[IO.File]::WriteAllText($ptr,$pointer)}
# An incomplete pointed revision must never become an apparently valid empty draft.
$rb=Join-Path $dir 'revisions/rev-2.body';$body=[IO.File]::ReadAllText($rb)
try {
 [IO.File]::Move($rb,$rb+'.review-missing')
 $o=Api Get "/$($c.work_id)" $null
 Check 'MISSING_REVISION_BODY' ($o.work_id -eq '' -or $o.body -eq '新正文') "id=$($o.work_id) rev=$($o.revision) body_length=$($o.body.Length)"
} finally {[IO.File]::Move($rb+'.review-missing',$rb)}
# Revision committed but index denied: retry must repair discoverability before success.
$slug='review-index-'+[Guid]::NewGuid().ToString('N')
$items=(@(@{slug=$slug;title='迁移原稿';body='迁移正文'})|ConvertTo-Json -Compress -AsArray)
$index=Join-Path $resolved 'index.json';$l=[IO.File]::Open($index,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
try {$first=Api Post '/migrate' @{items=$items}} finally {$l.Dispose()}
$second=Api Post '/migrate' @{items=$items}
$map=Get-Content -Raw (Join-Path $resolved 'slug-map.json')|ConvertFrom-Json
$id=$map.$slug;$ids=@((Get-Content -Raw $index|ConvertFrom-Json))
Check 'INDEX_RETRY' ($first -eq 0 -and $second -eq 1 -and $ids.Contains($id)) "first=$first second=$second id=$id index_has=$($ids.Contains($id))"
$slug='review-unicode-'+[Guid]::NewGuid().ToString('N')
$items='[{"slug":"'+$slug+'","title":"\u4e2d\u6587","body":"\u6b63\u6587"}]'
$count=Api Post '/migrate' @{items=$items}
$map=Get-Content -Raw (Join-Path $resolved 'slug-map.json')|ConvertFrom-Json
$o=Api Get "/$($map.$slug)" $null
Check 'JSON_UNICODE' ($count -eq 1 -and $o.title -eq '中文' -and $o.body -eq '正文') "count=$count title=$($o.title) body=$($o.body)"
if($script:failed){exit 1}
