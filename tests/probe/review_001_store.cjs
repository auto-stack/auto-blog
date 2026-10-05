// Executes the generated store with controlled API responses; never edits generated code.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'gen/front/vue/node_modules/typescript'));
const file = path.join(root, 'gen/front/vue/src/stores/useDraftStore.ts');
let source = fs.readFileSync(file, 'utf8').replace(/^import .*$/gm, '').replace('export function', 'function');
source += '\nglobalThis.store = useDraftStore();';
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const work = (id, body, rev=1) => ({work_id:id, title:id, body, summary:'', tags:'', revision:rev});
function setup(api={}) {
  const context = vm.createContext({ref: value => ({value}), list_drafts:async()=>[],
    open_draft:async id=>work(id,'盘上正文'), create_draft:async()=>work('a',''),
    save_draft:async()=>({ok:true,revision:2}), ...api});
  new vm.Script(code).runInContext(context);
  return context.store;
}
(async()=>{
  const vueRouter = require(path.join(root, 'gen/front/vue/node_modules/vue-router'));
  let routes = fs.readFileSync(path.join(root, 'gen/front/vue/src/router/index.ts'), 'utf8').replace(/^import .*$/gm, '').replace('export default router', 'globalThis.router = router');
  const routeContext = vm.createContext({createRouter:vueRouter.createRouter,createWebHashHistory:vueRouter.createMemoryHistory});
  new vm.Script(ts.transpileModule(routes,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText).runInContext(routeContext);
  console.log('DEFAULT_ROUTE',JSON.stringify({rootMatches:routeContext.router.resolve('/').matched.length,authorMatches:routeContext.router.resolve('/author').matched.length}));
  const initial=setup();
  try {
    const guarded = initial.has_current.value === false && initial.current.value == null;
    console.log('INITIAL_RENDER', guarded ? 'guarded-empty' : (initial.current.value && initial.current.value.work_id === '' ? 'empty-work' : 'has-data'));
  }
  catch(e) { console.log('INITIAL_RENDER',e.message); }
  let finish;
  const s=setup({save_draft:()=>new Promise(resolve=>finish=resolve), open_draft:async id=>work(id,'旧的已发送正文',2)});
  await s.NewDraft(); s.BodyEdit('旧的已发送正文'); const pending=s.SaveCurrent(); s.BodyEdit('保存途中继续输入');
  finish({ok:true,revision:2}); await pending;
  console.log('EDIT_DURING_SAVE',JSON.stringify({body:s.editing_body.value,dirty:s.dirty.value,state:s.save_state.value}));
  const failed=setup({create_draft:async()=>work('','')}); await failed.NewDraft();
  console.log('FAILED_CREATE',JSON.stringify({has:failed.has_current.value,state:failed.save_state.value,error:failed.error.value}));
  const rejected=setup({save_draft:async()=>{throw new Error('network offline')}}); await rejected.NewDraft(); rejected.BodyEdit('用户正文');
  try { await rejected.SaveCurrent(); } catch(e) { /* store may catch internally */ }
  console.log('NETWORK_ERROR',JSON.stringify({state:rejected.save_state.value,body:rejected.editing_body.value,error:rejected.error.value}));
  const switched=setup({save_draft:async()=>{throw new Error('save blocked')}}); await switched.NewDraft(); switched.BodyEdit('尚未保存的本机版'); await switched.OpenDraft('b');
  console.log('SWITCH_DIRTY',JSON.stringify({id:switched.current.value&&switched.current.value.work_id,body:switched.editing_body.value,dirty:switched.dirty.value,state:switched.save_state.value,error:switched.error.value}));
})().catch(e=>{console.error(e);process.exitCode=1;});
