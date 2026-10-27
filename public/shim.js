/* Apps Script-এর google.script.run নকল করে /api/rpc-তে পাঠায় */
window.google={script:{run:(function mk(ok,fail){return new Proxy({},{get:(_,fn)=>{
 if(fn==='withSuccessHandler')return f=>mk(f,fail);if(fn==='withFailureHandler')return f=>mk(ok,f);
 return(...args)=>fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fn,args})})
  .then(r=>r.json()).then(j=>{if(j.error)throw new Error(j.error);ok&&ok(j.data)}).catch(e=>fail?fail(e):console.error(e))}})})()}};
