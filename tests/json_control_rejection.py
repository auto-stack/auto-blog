"""Real production migration must reject raw C0 JSON controls before any write."""
import argparse,json,os,shutil,subprocess,tempfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--auto',required=True);p.add_argument('--scratch',required=True);a=p.parse_args()
repo=Path(__file__).resolve().parents[1];scope=Path(a.scratch).resolve();scope.mkdir(parents=True,exist_ok=True)
run=Path(tempfile.mkdtemp(prefix='migration-c0-',dir=scope)).resolve();assert run.is_relative_to(scope)
for name in ('works','drafts'):shutil.copyfile(repo/f'src/back/{name}.at',run/f'{name}.at')
def execute(name,items,data):
    program='use drafts\nuse fs\n'
    for i, item in enumerate(items):
        payload=run/(name+'-'+str(i)+'.json')
        payload.write_bytes(item.encode('utf-8'))
        program+='print(Json.encode(drafts.migrate_articles_batch(fs.read_text('+json.dumps(payload.as_posix())+'))))\n'
    path=run/(name+'.at');path.write_text(program,encoding='utf-8')
    result=subprocess.run([str(Path(a.auto).resolve()),str(path)],cwd=run,
        env=dict(os.environ,AUTO_BLOG_DATA=str(data)),capture_output=True,text=True,encoding='utf-8',timeout=90)
    (run/(name+'.log')).write_text(result.stdout+result.stderr,encoding='utf-8');assert result.returncode==0,result.stderr
    return [json.loads(s) for s in result.stdout.splitlines() if s.strip() and not s.startswith(('----','Running Auto '))]
bad=['[{"slug":"raw-'+str(c)+'","title":"bad'+chr(c)+'raw","body":"完整中文😀尾部","author":"review"}]' for c in range(32)]
data=run/'invalid-data';actual=execute('invalid',bad,data)
files=[str(p.relative_to(data)) for p in data.rglob('*') if p.is_file()]
receipt={'invalid_results':actual,'invalid_files':files,'raw_c0_cases':32,'scratch':str(run)}
(run/'result.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
assert actual==[0]*32 and not files,receipt
title='合法转义\n\t中文😀'
valid=json.dumps([{'slug':'escaped-control','title':title,'body':'完整中文😀尾部','author':'review'}],ensure_ascii=False)
good_data=run/'valid-data';good=execute('valid',[valid],good_data);assert good==[1],good
metas=list((good_data/'works').glob('*/meta.json'));assert len(metas)==1
assert json.loads(metas[0].read_text(encoding='utf-8'))['title']==title
assert (metas[0].parent/'body.txt').read_bytes()=='完整中文😀尾部'.encode('utf-8')
receipt.update(valid_escaped_migration=1,valid_title_and_body_exact=True)
(run/'result.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'raw_rejected':32,'zero_invalid_file_writes':True,'valid_escaped_migration':1,'receipt':str(run/'result.json')},ensure_ascii=False))

