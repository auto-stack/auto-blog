param(
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [string]$Base = 'http://localhost:17827'
)
# Review reproductions only. Server must use this fresh, isolated data directory.
$ErrorActionPreference = 'Stop'
$resolved = [IO.Path]::GetFullPath($DataRoot)
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not $resolved.StartsWith((Join-Path $workspace '.tmp') + [IO.Path]::DirectorySeparatorChar)) { throw 'Use an isolated workspace .tmp directory' }
function Api($method, $path, $data) {
    $args = @{ Uri="$Base/api/drafts$path"; Method=$method; TimeoutSec=30 }
    if ($null -ne $data) {
        $args.ContentType = 'application/json; charset=utf-8'
        $args.Body = [Text.Encoding]::UTF8.GetBytes(($data | ConvertTo-Json -Compress -Depth 10))
    }
    Invoke-RestMethod @args
}
$c = Api Post '' @{title='锁定正文'; body='旧正文'}
$bp = Join-Path $resolved "works/$($c.work_id)/body.txt"
$lock = [IO.File]::Open($bp, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
try {
    $s = Api Put "/$($c.work_id)" @{title='新标题'; summary=''; body='新正文'; tags=''; expected_rev=1}
    $o = Api Get "/$($c.work_id)" $null
    "LOCKED_BODY ok=$($s.ok) revision=$($o.revision) body=$($o.body)"
} finally { $lock.Dispose() }
$title = 'literal_BS_n and C:\new\test'
$e = Api Post '' @{title=$title; body='正文'}
$eo = Api Get "/$($e.work_id)" $null
"META_ROUNDTRIP equal=$($title -ceq $eo.title) input=$title actual_json=$(ConvertTo-Json -Compress $eo.title)"
# Establish a valid existing slug map, then deny overwriting it.
$seed = '[{"slug":"review-seed","title":"seed","body":"source"}]'
$null = Api Post '/migrate' @{items=$seed}
$mp = Join-Path $resolved 'slug-map.json'
$before = @((Get-Content -Raw (Join-Path $resolved 'index.json') | ConvertFrom-Json)).Count
$lock = [IO.File]::Open($mp, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
try {
    $items = '[{"slug":"review-locked-map","title":"source","body":"source body"}]'
    $m1 = Api Post '/migrate' @{items=$items}
    $m2 = Api Post '/migrate' @{items=$items}
    $after = @((Get-Content -Raw (Join-Path $resolved 'index.json') | ConvertFrom-Json)).Count
    "LOCKED_MAP first=$m1 second=$m2 new_works=$($after-$before) map_has_slug=$((Get-Content -Raw $mp).Contains('review-locked-map'))"
} finally { $lock.Dispose() }
# Valid JSON with whitespace must not silently drop an article.
$pretty = "[`n  { `"slug`": `"review-pretty`", `"title`": `"中文迁移`", `"body`": `"正文`" }`n]"
"PRETTY_MIGRATION count=$(Api Post '/migrate' @{items=$pretty})"
