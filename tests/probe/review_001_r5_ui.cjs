// Real Vue click/input handlers; hold only the target read response.
const path=require('node:path');const root=path.resolve(__dirname,'../..');
const {chromium,request}=require(path.join(root,'tests/node_modules/@playwright/test'));
(async()=>{
 const api=await request.newContext({baseURL:process.env.RW_API||'http://localhost:17837'});
 const suffix=Date.now(),a=await(await api.post('/api/drafts',{data:{title:'当前稿-'+suffix,body:'当前正文'}})).json();
 const b=await(await api.post('/api/drafts',{data:{title:'目标稿-'+suffix,body:'目标正文'}})).json();
 const browser=await chromium.launch({headless:true});let release;
 try{
  const page=await browser.newPage();await page.goto((process.env.RW_URL||'http://localhost:17836')+'/#/');
  await page.evaluate(async()=>{const {useDraftStore}=await import('/src/stores/useDraftStore.ts');await useDraftStore().LoadList()});
  await page.getByText(a.title,{exact:true}).click();await page.locator('textarea').waitFor();
  if(await page.locator('textarea').inputValue()!=='当前正文')throw Error('Initial open control failed');
  let signal;const entered=new Promise(r=>signal=r),gate=new Promise(r=>release=r);
  await page.route('**/api/drafts/'+b.work_id,async route=>{signal();await gate;await route.fulfill({json:b})});
  await page.getByText(b.title,{exact:true}).click();await entered;
  await page.locator('textarea').fill('打开等待期间继续输入');release();
  await page.waitForTimeout(500);const body=await page.locator('textarea').inputValue();
  const ok=body==='打开等待期间继续输入';console.log((ok?'PASS':'FAIL')+' BROWSER_EDIT_IN_OPEN_WAIT '+JSON.stringify({body,saved:(await page.locator('body').innerText()).includes('● 已保存')}));
  await page.screenshot({path:path.join(root,'.tmp/review-r5-ui-open-wait.png'),fullPage:true});if(!ok)process.exitCode=1;
 }finally{release?.();await browser.close();await api.dispose()}
})().catch(e=>{console.error(e);process.exitCode=1});
