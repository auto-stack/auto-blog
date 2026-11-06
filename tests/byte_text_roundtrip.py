"""Execute the real production text module on a selected SDK and owned fixtures."""
import argparse
import hashlib
import json
import re
from pathlib import Path
import shutil
import subprocess
import tempfile

p = argparse.ArgumentParser()
p.add_argument('--auto', required=True)
p.add_argument('--scratch', required=True)
a = p.parse_args()
repo = Path(__file__).resolve().parents[1]
scope = Path(a.scratch).resolve()
scope.mkdir(parents=True, exist_ok=True)
run = Path(tempfile.mkdtemp(prefix='byte-text-', dir=scope)).resolve()
assert run.is_relative_to(scope)
source = repo / 'src/back/works.at'
shutil.copyfile(source, run / 'works.at')
title = 'U054-中文标题😀-完整尾部54.25'
value = '第一段中文😀\n第二段 "引号" 和 \\ 路径\t尾部8.125'
def function_source(text, name):
    start = re.search(r'^(?:pub )?fn ' + re.escape(name) + r'\(', text, re.M).start()
    brace = text.index('{', start)
    depth, i, quoted, line_comment = 1, brace + 1, False, False
    while depth:
        c = text[i]
        if line_comment:
            if c == '\n': line_comment = False
        elif quoted:
            if c == '\\': i += 1
            elif c == '"': quoted = False
        elif text.startswith('//', i): line_comment = True; i += 1
        elif c == '"': quoted = True
        elif c == '{': depth += 1
        elif c == '}': depth -= 1
        i += 1
    return text[start:i]
draft_text = (repo / 'src/back/drafts.at').read_text(encoding='utf-8')
inline_names = ['map_str_strip_close', 'skip_json_string', 'skip_ws',
                'scan_json_string', 'scan_json_number', 'json_array_valid',
                'json_field_value_kind', 'batch_fields_valid', 'migrate_key', 'legacy_migrate_key']
inline = function_source(source.read_text(encoding='utf-8'), 'hex_val') + '\n'
inline += '\n'.join(function_source(draft_text, name) for name in inline_names)
retained = []
for filename, names in [('drafts.at', ['migrate_key']),
                        ('publications.at', ['content_hash', 'probe_fold'])]:
    current = (repo / 'src/back' / filename).read_text(encoding='utf-8')
    old = subprocess.check_output(['git', '-C', str(repo), 'show',
                                  '3ead087723dff0ea36df4f9abb64a942a92beeb6:src/back/' + filename],
                                 text=True, encoding='utf-8')
    for name in names:
        assert function_source(old, name) == function_source(current, name), name
        retained.append(filename + ':' + name)
long_meta = json.dumps({'title': '汉😀' * 80, 'revision': 54,
                        'created_at': 1790000054}, ensure_ascii=False, indent=2)
cases = [
    ('json_unescape', [title], title),
    ('json_unescape', [json.dumps(value, ensure_ascii=False)[1:-1]], value),
    ('json_unescape', [r'前\uD83D\uDE00后'], '前😀后'),
    ('json_unescape', [r'\uD800\u0041尾'], '\ufffdA尾'),
    ('json_unescape', [r'\uDC00尾'], '\ufffd尾'),
    ('json_unescape', [r'\uD800\uD800尾'], '\ufffd\ufffd尾'),
    ('json_field_str', [json.dumps({'title': title}, ensure_ascii=False), 'title'], title),
    ('json_field_str', [json.dumps({'标题': value}, ensure_ascii=False, indent=2), '标题'], value),
    ('json_field_str', ['{"title":"首个中文","title":"second"}', 'title'], '首个中文'),
    ('json_field_int', [long_meta, 'revision'], 54),
    ('json_field_int', [long_meta, 'created_at'], 1790000054),
    ('json_field_str', ['{"title":"ASCII"}', 'title'], 'ASCII'),
    ('json_field_str', ['{}', 'missing'], ''),
    ('json_field_int', ['{"revision":-5}', 'revision'], -5),
    ('join_path', ['D:/中文目录/', '正文😀.txt'], 'D:/中文目录/正文😀.txt'),
    ('join_path', ['D:/中文目录', '正文😀.txt'], 'D:/中文目录/正文😀.txt'),
    ('join_path', ['', '正文.txt'], '正文.txt'),
    ('join_path', ['D:/root/', 'body.txt'], 'D:/root/body.txt'),
    ('migrate_key', ['作者::甲', '条目'], '5::作者::甲::条目'),
    ('legacy_migrate_key', ['作者::甲', '条目'], '作者::甲::条目'),
    ('migrate_key', ['作者', '条目'], '作者::条目'),
    ('migrate_key', ['', 'a::b'], '1::_::a::b'),
    ('map_str_strip_close', ['{"作者":"中文😀"}'], '{"作者":"中文😀"'),
    ('json_array_valid', ['[{"title":"中文😀","nested":{"value":[1,true,null]}}]'], True),
    ('json_array_valid', ['[{}]'], True),
    ('json_array_valid', ['[1]'], False),
    ('json_array_valid', ['[{"title":"中文😀"},]'], False),
    ('json_array_valid', [r'[{"title":"bad\q"}]'], False),
    ('json_array_valid', ['[{"title":"中文😀","n":01}]'], False),
    ('batch_fields_valid', ['[{"title":"中文😀","body":"完整末尾"}]'], True),
    ('batch_fields_valid', ['[{"title":"中文😀","body":123}]'], False),
    ('json_field_value_kind', ['{"标题":"中文😀"}', '标题'], 1),
    ('json_array_valid', ['[{"n":0},{"n":-0},{"n":0.125},{"n":10.5e+2}]'], True),
    ('json_array_valid', ['[{"n":-01}]'], False),
    ('json_array_valid', ['[{"n":1e}]'], False),
    ('json_array_valid', ['[{"n":NaN}]'], False),
]
program = 'use works\n' + inline + '\n'
for function, args, _ in cases:
    rendered = ', '.join(json.dumps(v, ensure_ascii=False) for v in args)
    call = function if function in inline_names else 'works.' + function
    program += f'print(Json.encode({call}({rendered})))\n'
(run / 'probe.at').write_text(program, encoding='utf-8')
result = subprocess.run([str(Path(a.auto).resolve()), str(run / 'probe.at')],
                        cwd=run, capture_output=True, text=True, encoding='utf-8', timeout=60)
(run / 'probe.log').write_text(result.stdout + result.stderr, encoding='utf-8')
assert result.returncode == 0, result.stderr
lines = [line for line in result.stdout.splitlines() if line.strip()
         and not line.startswith(('----', 'Running Auto '))]
actual = [json.loads(line) for line in lines]
expected = [item[2] for item in cases]
receipt = {'source': str(source), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
           'cli_sha256': hashlib.sha256(Path(a.auto).read_bytes()).hexdigest(),
           'cases': len(cases), 'expected': expected, 'actual': actual, 'scratch': str(run),
           'retained_character_contracts_byte_identical': retained,
           'inline_production_helpers_sha256': hashlib.sha256(inline.encode()).hexdigest()}
(run / 'result.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
assert actual == expected, json.dumps(receipt, ensure_ascii=False)
assert all(type(x) is type(y) for x, y in zip(actual, expected))
print(json.dumps({'cases': len(cases), 'source_sha256': receipt['source_sha256'],
                  'receipt': str(run / 'result.json')}, ensure_ascii=False))
