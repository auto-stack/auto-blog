param([Parameter(Mandatory=$true)][string]$DataRoot,[string]$Base='http://localhost:17837',[ValidateSet('all','recovery','json','migration')][string]$Scope='all')
$ErrorActionPreference='Stop'
$resolved=[IO.Path]::GetFullPath($DataRoot);$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if(-not $resolved.StartsWith((Join-Path $root '.tmp')+[IO.Path]::DirectorySeparatorChar)){throw 'Use isolated workspace .tmp data'}
$script:failed=0
function Api($method,$path,$data){$a=@{Uri="$Base/api/drafts$path";Method=$method;TimeoutSec=90};if($null-ne$data){$a.ContentType='application/json; charset=utf-8';$a.Body=[Text.Encoding]::UTF8.GetBytes(($data|ConvertTo-Json -Compress -Depth 10))};Invoke-RestMethod @a}
function Check($name,$ok,$detail){if($ok){"PASS $name $detail"}else{"FAIL $name $detail";$script:failed++}}
function WriteReviewText($p,$s){[IO.File]::WriteAllText($p,$s,[Text.UTF8Encoding]::new($false))}
function ReadMap($file,$key){if(Test-Path (Join-Path $resolved $file)){(Get-Content -Raw (Join-Path $resolved $file)|ConvertFrom-Json).$key}}
if($Scope-in@('all','recovery')){
# Old-format revisions: no .ok existed before Phase 4; conveniences may be stale.
$c=Api Post '' @{title='旧格式';body='原确认正文'};$dir=Join-Path $resolved "works/$($c.work_id)"
$oldMeta=[IO.File]::ReadAllText((Join-Path $dir 'meta.json'))
$s=Api Put "/$($c.work_id)" @{title='旧格式新确认版';body='最新完整正文';summary='';tags='';expected_rev=1}
$o=Api Get "/$($c.work_id)" $null;Check 'REV2_CONTROL' ($s.ok-and$o.body-eq'最新完整正文') "rev=$($o.revision) body=$($o.body)"
$ptr=Join-Path $dir 'current.txt';$body2=Join-Path $dir 'revisions/rev-2.body';$meta2=Join-Path $dir 'revisions/rev-2.json'
$snapshot=@{};foreach($name in @('current.txt','meta.json','body.txt','revisions/rev-1.ok','revisions/rev-2.ok','revisions/rev-2.body','revisions/rev-2.json')){$snapshot[$name]=[IO.File]::ReadAllText((Join-Path $dir $name))}
try{
 WriteReviewText $body2 '半';$o=Api Get "/$($c.work_id)" $null
 Check 'COMMITTED_BODY_INTEGRITY' ($o.work_id-eq''-or$o.body-eq'最新完整正文') "id=$($o.work_id) rev=$($o.revision) body=$($o.body)"
 WriteReviewText $body2 $snapshot['revisions/rev-2.body']
 $m=$snapshot['revisions/rev-2.json']|ConvertFrom-Json;$m.work_id='foreign-work';WriteReviewText $meta2 ($m|ConvertTo-Json -Compress)
 $o=Api Get "/$($c.work_id)" $null;Check 'META_ID_INTEGRITY' ($o.work_id-eq''-or$o.work_id-eq$c.work_id) "requested=$($c.work_id) actual=$($o.work_id)"
 WriteReviewText $meta2 $snapshot['revisions/rev-2.json']
 foreach($name in @('revisions/rev-1.ok','revisions/rev-2.ok')){Remove-Item -LiteralPath (Join-Path $dir $name)}
 WriteReviewText (Join-Path $dir 'meta.json') $oldMeta;WriteReviewText (Join-Path $dir 'body.txt') '原确认正文';WriteReviewText $ptr ''
 $o=Api Get "/$($c.work_id)" $null;Check 'LEGACY_RECOVERY' ($o.revision-eq2-and$o.body-eq'最新完整正文') "rev=$($o.revision) body=$($o.body)"
}finally{foreach($name in $snapshot.Keys){WriteReviewText (Join-Path $dir $name) $snapshot[$name]}}
# Boundary is still a fixed bound, now 10000 rather than 200.
$m=$snapshot['revisions/rev-2.json']|ConvertFrom-Json;$m.revision=10001
WriteReviewText (Join-Path $dir 'revisions/rev-10001.json') ($m|ConvertTo-Json -Compress);WriteReviewText (Join-Path $dir 'revisions/rev-10001.body') '高版本完整正文';WriteReviewText (Join-Path $dir 'revisions/rev-10001.ok') '10001'
try{
 WriteReviewText $ptr '10001';$o=Api Get "/$($c.work_id)" $null;Check 'REV10001_CONTROL' ($o.revision-eq10001) "rev=$($o.revision)"
 WriteReviewText $ptr '';$o=Api Get "/$($c.work_id)" $null;Check 'REV10001_RECOVERY' ($o.revision-eq10001-and$o.body-eq'高版本完整正文') "rev=$($o.revision) body=$($o.body)"
}finally{WriteReviewText $ptr $snapshot['current.txt']}
}
if($Scope-in@('all','json')){
# Balanced punctuation alone is not JSON validation. Adjacent objects lack comma.
$slug='balanced-'+[Guid]::NewGuid().ToString('N')
$items='[{"slug":"'+$slug+'","title":"A","body":"A"} {"slug":"'+$slug+'-b","title":"B","body":"B"}]'
$count=Api Post '/migrate' @{items=$items};$id=ReadMap 'slug-map.json' $slug
Check 'BALANCED_INVALID_JSON' ($count-eq0-and-not$id) "count=$count id=$id"
$slug='unicode-d-'+[Guid]::NewGuid().ToString('N');$items='[{"slug":"'+$slug+'","title":"\uD000\u4e2d","body":"X"}]'
try{$count=Api Post '/migrate' @{items=$items}}catch{Check 'UNICODE_API_CONFIRMATION' $false $_.Exception.Message;$count=$null}
$id=ReadMap 'slug-map.json' $slug;$o=Api Get "/$id" $null
Check 'NON_SURROGATE_ADJACENT_UNICODE' (($null-eq$count-or$count-eq1)-and$o.title-eq([string][char]0xD000+'中')) "count=$count title=$($o.title)"
}
if($Scope-in@('all','migration')){
# Legacy map must keep the old identity when upgrading rather than duplicate it.
$slug='legacy-map-'+[Guid]::NewGuid().ToString('N');$legacy=Api Post '' @{title='旧迁移作品';body='OLD'}
$lmapPath=Join-Path $resolved 'slug-map.json';$lm=Get-Content -Raw $lmapPath|ConvertFrom-Json;$lm|Add-Member -NotePropertyName $slug -NotePropertyValue $legacy.work_id;WriteReviewText $lmapPath ($lm|ConvertTo-Json -Compress)
$items=(@(@{slug=$slug;title='旧迁移作品';body='OLD'})|ConvertTo-Json -Compress -AsArray);$count=Api Post '/migrate' @{items=$items};$id=ReadMap 'slug-map.json' $slug
Check 'LEGACY_MAP_IDENTITY' ($count-eq1-and$id-eq$legacy.work_id) "old=$($legacy.work_id) new=$id"
# source-map succeeds, slug-map fails: retry must repair both before reporting success.
$slug='map-retry-'+[Guid]::NewGuid().ToString('N');$items=(@(@{slug=$slug;title='MAP';body='MAP';author='retry'})|ConvertTo-Json -Compress -AsArray)
$lock=[IO.File]::Open($lmapPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
try{$first=Api Post '/migrate' @{items=$items}}finally{$lock.Dispose()}
$second=Api Post '/migrate' @{items=$items};$id=ReadMap 'slug-map.json' $slug;$sid=ReadMap 'source-map.json' ('retry::'+$slug)
Check 'TWO_MAP_RETRY' ($first-eq0-and$second-eq1-and$id-eq$sid-and$null-ne$id) "first=$first second=$second source=$sid slug=$id"
# Composite identity needs an unambiguous encoding for author and slug.
$suffix=[Guid]::NewGuid().ToString('N');$author='A::B';$slug='C-'+$suffix
$items=(@(@{slug=$slug;title='来源1';body='ONE';author=$author})|ConvertTo-Json -Compress -AsArray);$first=Api Post '/migrate' @{items=$items};$id1=ReadMap 'slug-map.json' $slug
$slug2='B::'+$slug;$items=(@(@{slug=$slug2;title='来源2';body='TWO';author='A'})|ConvertTo-Json -Compress -AsArray);$second=Api Post '/migrate' @{items=$items};$id2=ReadMap 'source-map.json' ('A::'+$slug2)
Check 'SOURCE_KEY_COLLISION' ($first-eq1-and$second-eq1-and$id2-ne$id1) "first=$id1 second=$id2"
}
if($script:failed){exit 1}
