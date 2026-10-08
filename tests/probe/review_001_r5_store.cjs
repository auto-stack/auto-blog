// Phase 4 review: matched successful replies and each asynchronous window.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'gen/front/vue/node_modules/typescript'));
const src=fs.readFileSync(path.join(root,'gen/front/vue/src/stores/useDraftStore.ts'),'utf8').replace(/^import .*$/gm,'').replace('export function','function');
const code=ts.transpileModule(src+'\nglobalThis.store=useDraftStore();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const w=(id,body='',revision=1)=>({work_id:id,title:'未命名草稿',body,summary:'',tags:'',revision});
function setup(api={}){const c=vm.createContext({ref:value=>({value}),list_drafts:async()=>[],create_draft:async()=>w('a'),open_draft:async id=>w(id,'发送正文',2),save_draft:async()=>({ok:true,revision:2}),...api});new vm.Script(code).runInContext(c);return c.store;}
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
let failed=0;const info=s=>({id:s.current.value?.work_id,rev:s.current.value?.revision,body:s.editing_body.value,summary:s.editing_summary.value,tags:s.editing_tags.value,dirty:s.dirty.value,state:s.save_state.value,lock:s.save_in_flight.value});
function check(name,ok,s){console.log((ok?'PASS':'FAIL')+' '+name+' '+JSON.stringify(s));if(!ok)failed++}
(async()=>{
 const control=setup();await control.NewDraft();control.BodyEdit('发送正文');await control.SaveCurrent();check('MATCHED_SAVE_CONTROL',control.save_state.value==='saved'&&control.current.value.revision===2,info(control));
 for(const mode of ['new','open','reload']){
  const d=defer();let creates=0;
  const s=setup({create_draft:async()=>++creates===1?w('a'):d.promise,open_draft:()=>d.promise});await s.NewDraft();
  const pending=mode==='new'?s.NewDraft():mode==='open'?s.OpenDraft('b'):s.ResolveKeepTheirs();
  s.BodyEdit('读或创建等待期间新输入');d.resolve(w(mode==='reload'?'a':'b','目标正文',2));await pending;
  check('EDIT_IN_TARGET_WAIT_'+mode,s.editing_body.value==='读或创建等待期间新输入'&&s.dirty.value,info(s));
 }
 const read=defer(),entered=defer();let count=0;
 const serial=setup({save_draft:async()=>{count++;return{ok:true,revision:2}},open_draft:()=>{entered.resolve();return read.promise}});await serial.NewDraft();serial.BodyEdit('发送正文');
 const save=serial.SaveCurrent();await entered.promise;
 const force=serial.ForceSave();check('SERIAL_DURING_READBACK',count===1,{requests:count,lock:serial.save_in_flight.value});read.resolve(w('a','发送正文',2));await Promise.all([save,force]);
 for(const mode of ['new','open']){
  const d=defer();let expected;
  const s=setup({save_draft:(id,t,su,b,ta,rev)=>{expected=rev;return d.promise}});await s.NewDraft();s.BodyEdit('发送正文');
  const pending=mode==='new'?s.NewDraft():s.OpenDraft('b');s.BodyEdit('更新正文');d.resolve({ok:true,revision:2});await pending;
  check('ABORT_UPDATES_REV_'+mode,s.current.value.revision===2&&s.editing_body.value==='更新正文'&&s.dirty.value,info(s));
 }
 for(const mismatch of ['revision','summary','tags']){
  const back=w('a','发送正文',2);back[mismatch]=mismatch==='revision'?1:'错误字段';
  const s=setup({open_draft:async()=>back});await s.NewDraft();s.BodyEdit('发送正文');await s.ForceSave();
  check('FORCE_MISMATCH_'+mismatch,s.save_state.value!=='saved'&&s.dirty.value,info(s));
 }
 const switchSummary=setup({open_draft:async id=>({...w(id,'发送正文',2),summary:'错误摘要'})});await switchSummary.NewDraft();switchSummary.BodyEdit('发送正文');await switchSummary.NewDraft();
 check('NEW_PRE_SAVE_SUMMARY',switchSummary.editing_body.value==='发送正文'&&switchSummary.dirty.value,info(switchSummary));
 process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
