// Actual Chromium check of opening an existing draft in a fresh author session.
const path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'../..');
const {chromium,request}=require(path.join(root,'tests/node_modules/@playwright/test'));
(async()=>{
 const api=await request.newContext({baseURL:process.env.RW_API||'http://localhost:17837'});
 const title='初次打开复审-'+Date.now();
 const created=await api.post('/api/drafts',{data:{title,body:'已有草稿正文'}});
 if(!created.ok())throw Error('Seed HTTP '+created.status());
 const w=await created.json();
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.goto((process.env.RW_URL||'http://localhost:17836')+'/#/');
  // Explicitly load the list as fixture setup; current remains null. The click
  // below still exercises the real Vue component and generated store handler.
  await page.evaluate(async()=>{
   const {useDraftStore}=await import('/src/stores/useDraftStore.ts');
   await useDraftStore().LoadList();
  });
  await page.getByText(title,{exact:true}).waitFor();
  await page.getByText(title,{exact:true}).click();
  await page.waitForTimeout(700);
  const visible=await page.locator('textarea').count();
  const text=await page.locator('body').innerText();
  const out=path.join(root,'.tmp/review-r4-ui-firstopen.png');
  await page.screenshot({path:out,fullPage:true});
  const ok=visible===1&&(await page.locator('textarea').inputValue())==='已有草稿正文';
  console.log((ok?'PASS':'FAIL')+' BROWSER_FIRST_OPEN '+JSON.stringify({id:w.work_id,textareaCount:visible,openFailed:text.includes('open_failed'),screenshot:out}));
  if(!ok)process.exitCode=1;
 }finally{await browser.close();await api.dispose();}
})().catch(e=>{console.error(e);process.exitCode=1;});
