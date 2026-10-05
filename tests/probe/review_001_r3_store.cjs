// Re-review of committed Phase 2: execute freshly generated store with controlled replies.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const ts=require(path.join(root,'gen/front/vue/node_modules/typescript'));
let source=fs.readFileSync(path.join(root,'gen/front/vue/src/stores/useDraftStore.ts'),'utf8').replace(/^import .*$/gm,'').replace('export function','function');
const code=ts.transpileModule(source+'\nglobalThis.store=useDraftStore();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const work=(id,body,rev=1)=>({work_id:id,title:id,body,summary:'',tags:'',revision:rev});
function setup(api={}){
 const c=vm.createContext({ref:value=>({value}),list_drafts:async()=>[],create_draft:async()=>work('new',''),open_draft:async id=>work(id,'盘上旧稿'),save_draft:async()=>({ok:true,revision:2}),...api});
 new vm.Script(code).runInContext(c);return c.store;
}
let failed=0;
function check(name,ok,evidence){console.log((ok?'PASS ':'FAIL ')+name+' '+JSON.stringify(evidence));if(!ok)failed++;}
(async()=>{
 for(const mode of ['conflict','network']){
  let creates=0;
  const s=setup({create_draft:async()=>work(++creates===1?'a':'b',''),save_draft:async()=>{if(mode==='network')throw Error('offline');return {ok:false,conflict:true,revision:2,error:'conflict'};}});
  await s.NewDraft();s.BodyEdit('不能丢的本机版');await s.NewDraft();
  check('NEW_AFTER_'+mode,s.current.value.work_id==='a'&&s.editing_body.value==='不能丢的本机版'&&s.dirty.value,{id:s.current.value.work_id,body:s.editing_body.value,state:s.save_state.value,creates});
 }
 const read=setup({open_draft:async()=>work('','')});await read.NewDraft();read.BodyEdit('已输入的正文');await read.SaveCurrent();
 check('EMPTY_READBACK',read.save_state.value!=='saved'&&read.editing_body.value==='已输入的正文',{id:read.current.value.work_id,body:read.editing_body.value,state:read.save_state.value,dirty:read.dirty.value});
 const same=setup();await same.NewDraft();same.BodyEdit('当前未保存正文');await same.OpenDraft('new');
 check('REOPEN_CURRENT_DIRTY',same.editing_body.value==='当前未保存正文',{id:same.current.value.work_id,body:same.editing_body.value,state:same.save_state.value});
 process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
