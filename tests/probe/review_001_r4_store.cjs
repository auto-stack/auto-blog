// Complete transition/readback counterexamples for the committed Phase 3 store.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'gen/front/vue/node_modules/typescript'));
let src=fs.readFileSync(path.join(root,'gen/front/vue/src/stores/useDraftStore.ts'),'utf8').replace(/^import .*$/gm,'').replace('export function','function');
const code=ts.transpileModule(src+'\nglobalThis.store=useDraftStore();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const work=(id,body,revision=1)=>({work_id:id,title:id,body,summary:'',tags:'',revision});
function setup(api={}){const c=vm.createContext({ref:value=>({value}),list_drafts:async()=>[],create_draft:async()=>work('a',''),open_draft:async id=>work(id,'正文',2),save_draft:async()=>({ok:true,revision:2}),...api});new vm.Script(code).runInContext(c);return c.store;}
let failed=0;function check(name,ok,detail){console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(detail));if(!ok)failed++;}
const detail=s=>({id:s.current.value?.work_id,body:s.editing_body.value,dirty:s.dirty.value,state:s.save_state.value,error:s.error.value});
(async()=>{
 const first=setup();await first.OpenDraft('existing');check('FIRST_OPEN',first.current.value?.work_id==='existing',detail(first));
 for(const mode of ['new','open']){
  let finish,creates=0;
  const s=setup({create_draft:async()=>work(++creates===1?'a':'b',''),save_draft:()=>new Promise(r=>finish=r)});
  await s.NewDraft();s.BodyEdit('已发送旧内容');const pending=mode==='new'?s.NewDraft():s.OpenDraft('b');
  s.BodyEdit('等待期间继续输入');finish({ok:true,revision:2});await pending;
  check('EDIT_DURING_'+mode,s.current.value?.work_id==='a'&&s.editing_body.value==='等待期间继续输入'&&s.dirty.value,detail(s));
 }
 const wrong=setup({open_draft:async id=>work(id,'不匹配的读回',2)});await wrong.NewDraft();wrong.BodyEdit('正文');await wrong.SaveCurrent();
 check('BODY_MISMATCH',wrong.editing_body.value==='正文'&&wrong.save_state.value!=='saved',detail(wrong));
 const force=setup({open_draft:async id=>work(id,'旧的服务端版本',1)});await force.NewDraft();force.BodyEdit('本机最新正文');await force.ForceSave();
 check('FORCE_STALE_READBACK',force.editing_body.value==='本机最新正文'&&force.save_state.value!=='saved',detail(force));
 let count=0,finish;
 const serial=setup({save_draft:()=>{count++;return new Promise(r=>finish=r)}});await serial.NewDraft();serial.BodyEdit('正文');
 const save=serial.SaveCurrent();const f=serial.ForceSave();check('FORCE_SERIAL',count===1,{requests:count});
 // Both pending calls can share a resolution after the request-count assertion.
 // Do not await these promises: vm context has no timers/resources to retain.
 process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
