import {neon} from '@neondatabase/serverless';
const URLV=String(process.env.DATABASE_URL||'').trim().replace(/^psql\s+/,'').replace(/^DATABASE_URL\s*=\s*/,'').replace(/^['"]|['"]$/g,'').trim();let sql;
const q=(t,p=[])=>{if(!sql){if(!URLV)throw new Error('DATABASE_URL সেট করা নেই — Vercel > Settings > Environment Variables এ দিয়ে Redeploy করুন');
 try{sql=neon(URLV)}catch(e){throw new Error('DATABASE_URL ফরম্যাট ভুল — এটা postgresql:// দিয়ে শুরু হতে হবে (কোটেশন বা psql ছাড়া)')}}return sql.query(t,p)};
const T={Settings:{t:'settings',c:['k','v']},Branches:{t:'branches',c:['branch','lat','lng','radius']},Shifts:{t:'shifts',c:['shift','start_t','end_t']},
 Staff:{t:'staff',c:['code','name','designation','branch','shift','pin','status','weekly_off']},Holidays:{t:'holidays',c:['d','name']},Leaves:{t:'leaves',c:['code','d_from','d_to','typ','note','status','applied_on','reason']},LeaveTypes:{t:'leave_types',c:['ltype','days','paid','kind']}};
const HEAD={Settings:['Key','Value'],Branches:['Branch','Lat','Lng','Radius'],Shifts:['Shift','Start','End'],Staff:['Code','Name','Designation','Branch','Shift','PIN','Status','WeeklyOff'],Holidays:['Date','Name'],Leaves:['Code','From','To','Type','Note','Status','Applied','Reason'],LeaveTypes:['Type','YearlyDays','Paid','Kind']};
const S=x=>x==null?'':String(x),nc=c=>S(c).trim().replace(/^0+(?=\d)/,''),active=s=>S(s.status||'Active').toLowerCase()!=='inactive';
const toArr=x=>Array.isArray(x)&&x.length&&x.every(Array.isArray)?x:[x],ok128=a=>Array.isArray(a)&&a.length===128&&a.every(Number.isFinite);
const auth=p=>{if(!process.env.ADMIN_PASS||S(p)!==process.env.ADMIN_PASS)throw new Error('পাসওয়ার্ড ভুল')};
async function cfg(){const o={};(await q('select k,v from settings')).forEach(r=>o[r.k]=r.v);o.Timezone=o.Timezone||'Asia/Dhaka';return o}
const now=tz=>{const d=new Date();return{date:d.toLocaleDateString('en-CA',{timeZone:tz}),time:d.toLocaleTimeString('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}),ts:d.toISOString()}};
const dist=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))};
const findStaff=async c=>(await q('select * from staff')).find(s=>nc(s.code)===nc(c));
async function shiftOf(s){const x=(await q('select * from shifts where shift=$1',[s.shift]))[0];return x?{start:x.start_t,end:x.end_t}:{start:'09:30',end:'21:30'}}
async function sheet(n){const m=T[n];if(!m)throw new Error('অনুমোদিত নয়');const r=await q(`select id,${m.c.join(',')} from ${m.t} order by id`);return{head:HEAD[n],rows:r.map(o=>({i:o.id,v:m.c.map(c=>S(o[c]))}))}}
const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],okD=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(new Date(d+'T00:00:00Z')),
 rng=(a,b)=>{const o=[],d=new Date(a+'T00:00:00Z'),e=new Date(b+'T00:00:00Z');for(let n=0;d<=e&&n<400;n++,d.setUTCDate(d.getUTCDate()+1))o.push(d.toISOString().slice(0,10));return o},
 wd=d=>DN[new Date(d+'T00:00:00Z').getUTCDay()],approved=l=>{const x=S(l.status).trim().toLowerCase();return x===''||x==='approved'};
const DEFLT={name:'সংরক্ষিত ছুটি',days:12,paid:true,holiday:false};
async function leaveTypes(){const m={};let main='';(await q('select * from leave_types order by id')).forEach(t=>{const n=S(t.ltype).trim();if(!n)return;const dv=S(t.days).trim(),dn=dv===''?null:Number(dv),o={name:n,days:(dn==null||isNaN(dn))?null:dn,paid:S(t.paid||'Yes').trim().toLowerCase()!=='no',holiday:S(t.kind).trim().toLowerCase()==='holiday'};m[n]=o;if(!main&&o.days!=null&&o.paid&&!o.holiday)main=n});
 if(!Object.keys(m).length){m[DEFLT.name]=DEFLT;main=DEFLT.name}return{m,main}}
function leaveCalc(code,leaves,lt,hols,offs,year){const set={},by={};
 leaves.filter(l=>nc(l.code)===nc(code)&&approved(l)).sort((a,b)=>S(a.d_from).localeCompare(S(b.d_from))).forEach(l=>{if(!okD(S(l.d_from))||!okD(S(l.d_to)))return;const t=lt.m[S(l.typ).trim()]||lt.m[lt.main]||DEFLT;if(t.holiday)return;
  rng(S(l.d_from),S(l.d_to)).forEach(d=>{if(d.slice(0,4)!==String(year)||hols[d]||offs.indexOf(wd(d))>=0||set[d])return;set[d]=t.name})});
 Object.keys(set).sort().forEach(d=>(by[set[d]]=by[set[d]]||[]).push(d));return by}
const balOf=(lt,by)=>Object.values(lt.m).filter(t=>!t.holiday).map(t=>{const used=(by[t.name]||[]).length,pd=!t.paid?0:(t.days==null?used:Math.min(used,t.days));return{type:t.name,quota:t.days,paid:t.paid,used,unpaid:used-pd,left:(t.paid&&t.days!=null)?Math.max(0,t.days-used):null}});
async function staffAuth(code,pin){const s=await findStaff(code);if(!s||S(s.pin).trim()!==S(pin).trim())return{err:'PIN সঠিক নয়'};if(!active(s))return{err:'স্টাফ সক্রিয় নয়'};return{s}}
async function leaveAdd(s,type,from,to,reason,status,by){from=S(from).trim();to=S(to).trim()||from;if(!okD(from)||!okD(to))return{ok:false,message:'তারিখ দিন'};if(to<from)return{ok:false,message:'"পর্যন্ত" তারিখ "থেকে" তারিখের আগে হতে পারে না'};
 if(rng(from,to).length>=400)return{ok:false,message:'এত লম্বা সময়ের ছুটি দেওয়া যায় না'};
 const lt=await leaveTypes(),t=lt.m[S(type).trim()];if(!t||(by==='staff'&&t.holiday))return{ok:false,message:'ছুটির ধরন বেছে নিন'};
 const ex=(await q('select * from leaves')).filter(l=>nc(l.code)===nc(s.code)&&S(l.status).trim().toLowerCase()!=='rejected'&&S(l.d_from)<=to&&S(l.d_to)>=from);
 if(ex.length)return{ok:false,message:'এই সময়ে আগেই আবেদন/ছুটি আছে ('+ex[0].d_from+' থেকে '+ex[0].d_to+')'};
 const c=await cfg(),n=now(c.Timezone);await q('insert into leaves(code,d_from,d_to,typ,note,status,applied_on,reason) values($1,$2,$3,$4,$5,$6,$7,$8)',[s.code,from,to,t.name,'',status,n.date,S(reason).slice(0,300)]);return{ok:true}}
const F={
async staffInfo(code){const s=await findStaff(code);if(!s)return{ok:false,message:'স্টাফ পাওয়া যায়নি'};if(!active(s))return{ok:false,message:'এই স্টাফ সক্রিয় নয়'};
 const c=await cfg(),a=(await q('select in_t,out_t from attendance where d=$1 and code=$2',[now(c.Timezone).date,s.code]))[0]||{},w=await shiftOf(s);
 return{ok:true,face:!!s.face,name:s.name,designation:s.designation,branch:s.branch,shift:w.start+' - '+w.end,in:a.in_t||'',out:a.out_t||''}},
async punch(code,pin,type,lat,lng,acc,desc,blink){const s=await findStaff(code),c=await cfg();
 if(!s||S(s.pin).trim()!==S(pin).trim())return{ok:false,message:'PIN সঠিক নয়'};if(!active(s))return{ok:false,message:'স্টাফ সক্রিয় নয়'};
 let src='Mobile';
 if(s.face){let ref=null;try{ref=JSON.parse(s.face)}catch(e){}
  const refs=Array.isArray(ref)?toArr(ref).filter(ok128):[],ds=Array.isArray(desc)?toArr(desc).filter(ok128).slice(0,5):[];
  if(!ds.length)return{ok:false,message:'মুখ যাচাই সম্পন্ন হয়নি — ক্যামেরার সামনে সোজা তাকান'};
  if(!refs.length)return{ok:false,message:'মুখের নিবন্ধন নষ্ট — অ্যাডমিনকে বলুন আবার নিবন্ধন করতে'};
  let fd=9;for(const a of ds)for(const b of refs)fd=Math.min(fd,Math.sqrt(a.reduce((t,x,k)=>t+(x-b[k])**2,0)));
  if(fd>(Number(c.FaceThreshold)||0.55))return{ok:false,message:'মুখ মিলছে না ('+fd.toFixed(2)+')। নিজের মুখ দিয়ে চেষ্টা করুন'};src='Mobile+Face'}
 else if(c.FaceRequired==='1')return{ok:false,message:'আপনার মুখ নিবন্ধন করা নেই — অ্যাডমিনের সাথে যোগাযোগ করুন'};
 lat=Number(lat);lng=Number(lng);acc=Number(acc)||0;if(!lat||!lng)return{ok:false,message:'লোকেশন পাওয়া যায়নি'};
 if(acc>(Number(c.MaxAccuracy)||100))return{ok:false,message:'GPS নির্ভুল নয় ('+Math.round(acc)+' মি)। মোবাইল থেকে হাজিরা দিন; কম্পিউটারে GPS থাকে না'};
 const b=(await q('select * from branches where branch=$1',[s.branch]))[0];if(!b||!Number(b.lat)||!Number(b.lng))return{ok:false,message:'এই শাখার লোকেশন সেট করা নেই'};
 const d=Math.round(dist(lat,lng,Number(b.lat),Number(b.lng)));if(d>(Number(b.radius)||150))return{ok:false,message:'আপনি শাখা থেকে '+d+' মিটার দূরে আছেন'};
 const n=now(c.Timezone),a=(await q('select * from attendance where d=$1 and code=$2',[n.date,s.code]))[0];
 if(type==='IN'){if(a&&a.in_t)return{ok:false,message:'আজ আপনি '+a.in_t+'-এ IN দিয়েছেন'};
  await q(`insert into attendance(d,code,name,branch,in_t,in_dist,source,upd) values($1,$2,$3,$4,$5,$6,$8,$7) on conflict(d,code) do update set in_t=$5,in_dist=$6,upd=$7`,[n.date,s.code,s.name,s.branch,n.time,String(d),n.ts,src]);}
 else{if(!a||!a.in_t)return{ok:false,message:'আগে IN দিন'};await q('update attendance set out_t=$3,out_dist=$4,upd=$5 where d=$1 and code=$2',[n.date,s.code,n.time,String(d),n.ts]);}
 return{ok:true,message:type+' সফল হয়েছে: '+n.time}},
async adminData(p,month){auth(p);const c=await cfg(),o={month,today:now(c.Timezone).date,tabs:{},att:[],faces:(await q("select code from staff where face is not null and face<>''")).map(x=>x.code)};
 for(const n of Object.keys(T)){try{o.tabs[n]=await sheet(n)}catch(e){throw new Error('ডেটাবেস আপডেট বাকি — leave.sql চালান ('+n+')')}}
 (await q('select d,code,in_t,out_t,note from attendance where d like $1',[month+'%'])).forEach(r=>o.att.push({d:r.d,c:r.code,in:r.in_t||'',out:r.out_t||'',note:r.note||''}));return o},
async adminSetRow(p,n,row,arr){auth(p);const m=T[n];if(!m)throw new Error('অনুমোদিত নয়');const v=m.c.map((_,i)=>S(arr[i]).trim());
 if(row>0)await q(`update ${m.t} set ${m.c.map((c,i)=>c+'=$'+(i+1)).join(',')} where id=$${m.c.length+1}`,[...v,row]);
 else await q(`insert into ${m.t}(${m.c.join(',')}) values(${m.c.map((_,i)=>'$'+(i+1)).join(',')})`,v);return{ok:true}},
async adminSaveFace(p,code,json){auth(p);const s=await findStaff(code);if(!s)throw new Error('স্টাফ পাওয়া যায়নি');let a;try{a=JSON.parse(json)}catch(e){}
 a=Array.isArray(a)?toArr(a):[];if(!a.length||a.length>12||!a.every(ok128))throw new Error('মুখের তথ্য সঠিক নয়');await q('update staff set face=$1 where id=$2',[JSON.stringify(a),s.id]);return{ok:true}},
async adminDelFace(p,code){auth(p);const s=await findStaff(code);if(!s)throw new Error('স্টাফ পাওয়া যায়নি');await q("update staff set face='' where id=$1",[s.id]);return{ok:true}},
async adminDelRow(p,n,row){auth(p);if(!T[n]||n==='Settings')throw new Error('অনুমোদিত নয়');await q(`delete from ${T[n].t} where id=$1`,[row]);return{ok:true}},
async adminDelPunch(p,code,date){auth(p);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('তারিখ দিন');const s=await findStaff(code);if(!s)throw new Error('স্টাফ পাওয়া যায়নি');await q('delete from attendance where d=$1 and code=$2',[date,s.code]);return{ok:true}},
async deviceSync(key,rows){const k=process.env.DEVICE_KEY||process.env.ADMIN_PASS;if(!k||S(key)!==k)throw new Error('কী ভুল');
 if(!Array.isArray(rows)||rows.length>500)throw new Error('ডাটা সঠিক নয়');
 const c=await cfg(),gap=Number(c.DeviceMinGap)||10,staff=await q('select * from staff'),by={},unknown=new Set();
 for(const r of rows){const m=/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(S(r&&r.ts));if(!m)continue;const s=staff.find(x=>nc(x.code)===nc(r.code));
  if(!s||!active(s)){unknown.add(S(r.code));continue}const k2=m[1]+'|'+nc(s.code);(by[k2]=by[k2]||{d:m[1],s,t:[]}).t.push(m[2]+':'+m[3])}
 const ds=Object.values(by).map(x=>x.d).sort(),ex={};
 if(ds.length)(await q('select * from attendance where d>=$1 and d<=$2',[ds[0],ds[ds.length-1]])).forEach(a=>ex[a.d+'|'+nc(a.code)]=a);
 const mins=t=>+t.slice(0,2)*60+ +t.slice(3,5);let saved=0,manual=0;
 for(const k2 in by){const{d,s,t}=by[k2],a=ex[k2];if(a&&a.source==='Manual'){manual++;continue}
  const all=[...t,a&&a.in_t,a&&a.out_t].filter(Boolean).sort(),tin=all[0],last=all[all.length-1],tout=mins(last)-mins(tin)>=gap?last:(a&&a.out_t)||'',
  src=a?(S(a.source).includes('Device')?a.source:(S(a.source)||'Mobile')+'+Device'):'Device';
  await q(`insert into attendance(d,code,name,branch,in_t,out_t,source,upd) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(d,code) do update set in_t=$5,out_t=$6,source=$7,upd=$8`,[d,s.code,s.name,s.branch,tin,tout,src,new Date().toISOString()]);saved++}
 return{ok:true,saved,manual,unknown:[...unknown]}},
async leaveApply(code,pin,type,from,to,reason){const a=await staffAuth(code,pin);if(a.err)return{ok:false,message:a.err};const r=await leaveAdd(a.s,type,from,to,reason,'Pending','staff');return r.ok?{ok:true,message:'আবেদন জমা হয়েছে — অনুমোদনের অপেক্ষায়'}:r},
async leaveMine(code,pin){const a=await staffAuth(code,pin);if(a.err)return{ok:false,message:a.err};const s=a.s,c=await cfg(),year=Number(now(c.Timezone).date.slice(0,4)),lt=await leaveTypes(),all=await q('select * from leaves'),hols={};(await q('select d from holidays')).forEach(h=>hols[S(h.d)]=1);
 const by=leaveCalc(s.code,all,lt,hols,S(s.weekly_off||c.WeeklyOff||'Fri').split(/[ ,]+/),year);
 return{ok:true,year,types:Object.values(lt.m).filter(t=>!t.holiday).map(t=>t.name),bal:balOf(lt,by),
  apps:all.filter(l=>nc(l.code)===nc(s.code)).sort((x,y)=>y.id-x.id).slice(0,15).map(l=>({id:l.id,type:S(l.typ),from:S(l.d_from),to:S(l.d_to),status:S(l.status).trim()||'Approved',reason:S(l.reason),note:S(l.note)}))}},
async leaveCancel(code,pin,id){const a=await staffAuth(code,pin);if(a.err)return{ok:false,message:a.err};const l=(await q('select * from leaves where id=$1',[id]))[0];
 if(!l||nc(l.code)!==nc(a.s.code)||S(l.status).trim()!=='Pending')return{ok:false,message:'এই আবেদন বাতিল করা যাবে না'};await q('delete from leaves where id=$1',[id]);return{ok:true,message:'আবেদন বাতিল হয়েছে'}},
async adminLeaveAdd(p,code,type,from,to,reason){auth(p);const s=await findStaff(code);if(!s)throw new Error('স্টাফ পাওয়া যায়নি');const r=await leaveAdd(s,type,from,to,reason,'Approved','admin');if(!r.ok)throw new Error(r.message);return r},
async adminLeaveDecide(p,id,status,note){auth(p);if(status!=='Approved'&&status!=='Rejected')throw new Error('অবস্থা ভুল');const l=(await q('select * from leaves where id=$1',[id]))[0];if(!l)throw new Error('আবেদন পাওয়া যায়নি');
 await q('update leaves set status=$1,note=$2 where id=$3',[status,S(note).slice(0,200),id]);return{ok:true}},
async adminYear(p,year){auth(p);if(!/^\d{4}$/.test(S(year)))throw new Error('বছর সঠিক নয়');return(await q('select d,code,in_t,out_t,note from attendance where d like $1',[S(year)+'%'])).map(r=>({d:r.d,c:r.code,in:r.in_t||'',out:r.out_t||'',note:r.note||''}))},
async adminSavePunch(p,code,date,tin,tout,note){auth(p);const s=await findStaff(code);if(!s)throw new Error('স্টাফ পাওয়া যায়নি');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('তারিখ দিন');
 await q(`insert into attendance(d,code,name,branch,in_t,out_t,source,note,upd) values($1,$2,$3,$4,$5,$6,'Manual',$7,$8) on conflict(d,code) do update set in_t=$5,out_t=$6,source='Manual',note=$7,upd=$8`,[date,s.code,s.name,s.branch,tin||'',tout||'',note||'',new Date().toISOString()]);return{ok:true}}};
export default async function handler(req,res){try{if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 const{fn,args=[]}=req.body||{};if(!F[fn])throw new Error('অজানা অনুরোধ');res.json({data:await F[fn](...args)})}catch(e){res.json({error:e.message})}}
