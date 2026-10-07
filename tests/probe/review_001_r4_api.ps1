param([Parameter(Mandatory=$true)][string]$DataRoot,[string]$Base='http://localhost:17837')
$ErrorActionPreference='Stop'
$resolved=[IO.Path]::GetFullPath($DataRoot);$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if(-not $resolved.StartsWith((Join-Path $root '.tmp')+[IO.Path]::DirectorySeparatorChar)){throw 'Use isolated workspace .tmp data'}
$script:failed=0
function Api($method,$path,$data){$a=@{Uri="$Base/api/drafts$path";Method=$method;TimeoutSec=30};if($null-ne$data){$a.ContentType='application/json; charset=utf-8';$a.Body=[Text.Encoding]::UTF8.GetBytes(($data|ConvertTo-Json -Compress -Depth 10))};Invoke-RestMethod @a}
function Check($name,$ok,$detail){if($ok){"PASS $name $detail"}else{"FAIL $name $detail";$script:failed++}}
# A legitimate long-session revision fixture: same Work format, current revision 201.
$c=Api Post '' @{title='长会话';body='原始稿'};$dir=Join-Path $resolved "works/$($c.work_id)"
$meta=Get-Content -Raw (Join-Path $dir 'revisions/rev-1.json')|ConvertFrom-Json
$meta.revision=201
[IO.File]::WriteAllText((Join-Path $dir 'revisions/rev-201.json'),($meta|ConvertTo-Json -Compress))
[IO.File]::WriteAllText((Join-Path $dir 'revisions/rev-201.body'),'已确认201版正文')
$ptr=Join-Path $dir 'current.txt';$original=[IO.File]::ReadAllText($ptr)
try{
 [IO.File]::WriteAllText($ptr,'201');$before=Api Get "/$($c.work_id)" $null
 Check 'REV201_CONTROL' ($before.revision-eq201-and$before.body-eq'已确认201版正文') "rev=$($before.revision) body=$($before.body)"
 [IO.File]::WriteAllText($ptr,'');$after=Api Get "/$($c.work_id)" $null
 Check 'REV201_RECOVERY' ($after.revision-eq201-and$after.body-eq'已确认201版正文') "rev=$($after.revision) body=$($after.body)"
}finally{[IO.File]::WriteAllText($ptr,$original)}
# A stopped candidate body write leaves both names but does not make a complete commit.
$meta.revision=2
[IO.File]::WriteAllText((Join-Path $dir 'revisions/rev-2.json'),($meta|ConvertTo-Json -Compress))
[IO.File]::WriteAllText((Join-Path $dir 'revisions/rev-2.body'),'半写')
try{
 [IO.File]::WriteAllText($ptr,'');$o=Api Get "/$($c.work_id)" $null
 Check 'PARTIAL_CANDIDATE' ($o.work_id-eq''-or($o.revision-eq1-and$o.body-eq'原始稿')) "rev=$($o.revision) body=$($o.body)"
}finally{[IO.File]::WriteAllText($ptr,$original)}
foreach($case in @('emoji','malformed','origin-a','origin-b')){
 $slug='review-r4-'+$case+'-'+[Guid]::NewGuid().ToString('N')
 if($case-eq'emoji'){$items='[{"slug":"'+$slug+'","title":"\uD83D\uDE00","body":"emoji"}]'}
 elseif($case-eq'malformed'){$items='[{"slug":"'+$slug+'","title":"bad","body":"bad"'}
 elseif($case-eq'origin-a'){$shared=$slug;$items='[{"slug":"'+$shared+'","title":"来源A","body":"A","author":"A"}]'}
 else{$slug=$shared;$items='[{"slug":"'+$shared+'","title":"来源B","body":"B","author":"B"}]'}
 try{
  $count=Api Post '/migrate' @{items=$items}
  $map=Get-Content -Raw (Join-Path $resolved 'slug-map.json')|ConvertFrom-Json
  $id=$map.$slug;$o=if($id){Api Get "/$id" $null}else{$null}
  if($case-eq'emoji'){Check 'SURROGATE_PAIR' ($count-eq1-and$o.title-eq([char]::ConvertFromUtf32(0x1f600))) "count=$count title=$($o.title)"}
  elseif($case-eq'malformed'){Check 'INVALID_JSON_REJECTED' ($count-eq0-and-not$id) "count=$count id=$id"}
  elseif($case-eq'origin-a'){$firstId=$id;Check 'SOURCE_CONTROL' ($count-eq1-and$o.body-eq'A') "id=$id body=$($o.body)"}
  else{Check 'DISTINCT_SOURCE_SAME_SLUG' ($count-eq1-and$id-ne$firstId-and$o.body-eq'B') "same_id=$($id-eq$firstId) body=$($o.body)"}
 }catch{Check ('API_'+$case) $false $_.Exception.Message}
}
if($script:failed){exit 1}
