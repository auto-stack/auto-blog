"""Legal JSON controls survive actual migration, strict files and later edits."""
import argparse,hashlib,json,os,shutil,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--auto',required=True);p.add_argument('--scratch',required=True);a=p.parse_args()
repo=Path(__file__).resolve().parents[1];scope=Path(a.scratch).resolve();scope.mkdir(parents=True,exist_ok=True)
run=Path(tempfile.mkdtemp(prefix='escaped-c0-',dir=scope));data=run/'data'
for name in ('works','drafts'):shutil.copyfile(repo/f'src/back/{name}.at',run/f'{name}.at')
values=[chr(c) for c in range(32)]+['literal\\b\\f\\u0001\\n\\"\\\\']
items=[dict(slug='item-'+str(c)+v,author='作者'+v,title='前'+v+'😀尾',body='正文'+v+'完整') for c,v in enumerate(values)]
payload=run/'payload.json';payload.write_bytes(json.dumps(items,ensure_ascii=False).encode('utf-8'))
read='fs.read_text('+json.dumps(payload.as_posix())+')'
def execute(name,program):
    src=run/(name+'.at');src.write_text('use drafts\nuse fs\n'+program,encoding='utf-8')
    result=subprocess.run([str(Path(a.auto).resolve()),str(src)],cwd=run,env=dict(os.environ,AUTO_BLOG_DATA=str(data)),capture_output=True,text=True,encoding='utf-8',timeout=120)
    (run/(name+'.log')).write_text(result.stdout+result.stderr,encoding='utf-8');assert result.returncode==0,result.stderr
    return [json.loads(s) for s in result.stdout.splitlines() if s.strip() and not s.startswith(('----','Running Auto '))]
def snapshot():return {str(p.relative_to(data)):hashlib.sha256(p.read_bytes()).hexdigest() for p in data.rglob('*') if p.is_file()}
probe='print(Json.encode(drafts.migrate_articles_batch('+read+')))\nvar list = drafts.list_drafts()\nprint(Json.encode(list.length))\nfor w in list {\nprint(Json.encode(w.work_id))\nprint(Json.encode(w.title))\nvar opened = drafts.open_draft(w.work_id)\nprint(Json.encode(opened.title))\nprint(Json.encode(opened.body))\n}\n'
actual=execute('migrate',probe);assert actual[:2]==[len(items),len(items)],actual[:2]
by_title={item['title']:item['body'] for item in items};ids=[]
for i in range(2,len(actual),4):
    wid,title,opened,body=actual[i:i+4];assert title==opened and by_title[title]==body,(title,opened,body);ids.append(wid)
assert len(ids)==len(items) and len(set(ids))==len(items)
strict_files={}
for path in data.rglob('*.json'):strict_files[str(path.relative_to(data))]=json.loads(path.read_text(encoding='utf-8'))
before=snapshot();repeated=execute('repeat',probe);assert repeated==actual and snapshot()==before,'Retry must preserve identities and all committed bytes'
edited=execute('edit','var list = drafts.list_drafts()\nfor item in list {\nvar w = drafts.open_draft(item.work_id)\nvar saved = drafts.save_draft(w.work_id,w.title,w.summary,w.body + "继续😀",w.tags,w.cover_asset,w.body_format,w.revision)\nprint(Json.encode(saved.ok))\nprint(Json.encode(saved.revision))\nvar opened = drafts.open_draft(w.work_id)\nprint(Json.encode(opened.title))\nprint(Json.encode(opened.body))\n}\n')
for i in range(0,len(edited),4):
    ok,rev,title,body=edited[i:i+4];assert ok is True and rev==2 and body==by_title[title]+'继续😀'
for path in data.rglob('*.json'):json.loads(path.read_text(encoding='utf-8'))
receipt={'raw_c0_values':32,'literal_backslash_control':True,'migration_list_open_exact':True,'strict_json_files':len(strict_files),'idempotent_retry_bytes_unchanged':True,'continued_save_open_exact':True,'works_sha256':hashlib.sha256((repo/'src/back/works.at').read_bytes()).hexdigest()}
(run/'result.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(receipt,receipt=str(run/'result.json')),ensure_ascii=False))
