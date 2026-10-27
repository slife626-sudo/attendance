import {neon} from '@neondatabase/serverless';
const URLV=String(process.env.DATABASE_URL||'').trim().replace(/^psql\s+/,'').replace(/^DATABASE_URL\s*=\s*/,'').replace(/^['"]|['"]$/g,'').trim();let sql;
const q=(t,p=[])=>{if(!sql){if(!URLV)throw new Error('DATABASE_URL সেট করা নেই — Vercel > Settings > Environment Variables এ দিয়ে Redeploy করুন');
 try{sql=neon(URLV)}catch(e){throw new Error('DATABASE_URL ফরম্যাট ভুল — এটা postgresql:// দিয়ে শুরু হতে হবে (কোটেশন বা psql ছাড়া)')}}return sql.query(t,p)};
const T={Settings:{t:'settings',c:['k','v']},Branches:{t:'branches',c:['branch','lat','lng','radius']},Shifts:{t:'shifts',c:['shift','start_t','end_t']},
 Staff:{t:'staff',c:['code','name','designation','branch','shift','pin','status','weekly_off']},Holidays:{t:'holidays',c:['d','name']},Leaves:{t:'leaves',c:['code','d_from','d_to','typ','note']}};
const HEAD={Settings:['Key','Value'],Branches:['Branch','Lat','Lng','Radius'],Shifts:['Shift','Start','End'],Staff:['Code','Name','Designation','Branch','Shift','PIN','Status','WeeklyOff'],Holidays:['Date','Name'],Leaves:['Code','From','To','Type','Note']};
const S=x=>x==null?'':String(x),nc=c=>S(c).trim().replace(/^0+(?=\d)/,''),active=s=>S(s.status||'Active').toLowerCase()!=='inactive';
const auth=p=>{if(!process.env.ADMIN_PASS||S(p)!==process.env.ADMIN_PASS)throw new Error('পাসওয়ার্ড ভুল')};
async function cfg(){const o={};(await q('select k,v from settings')).forEach(r=>o[r.k]=r.v);o.Timezone=o.Timezone||'Asia/Dhaka';return o}
const now=tz=>{const d=new Date();return{date:d.toLocaleDateString('en-CA',{timeZone:tz}),time:d.toLocaleTimeString('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}),ts:d.toISOString()}};
const dist=(a,b,c,d)=>{const r=Math.PI/180,x=(c-a)*r,y=(d-b)*r,h=Math.sin(x/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))};
const findStaff=async c=>(await q('select * from staff')).find(s=>nc(s.code)===nc(c));
async function shiftOf(s){const x=(await q('select * from shifts where shift=$1',[s.shift]))[0];return x?{start:x.start_t,end:x.end_t}:{start:'09:30',end:'21:30'}}
async function sheet(n){const m=T[n];if(!m)throw new Error('অনুমোদিত নয়');const r=await q(`select id,${m.c.join(',')} from ${m.t} order by id`);return{head:HEAD[n],rows:r.map(o=>({i:o.id,v:m.c.map(c=>S(o[c]))}))}}
const F={
async staffInfo(code){const s=await findStaff(code);if(!s)return{ok:false,message:'স্টাফ পাওয়া যায়নি'};if(!active(s))return{ok:false,message:'এই স্টাফ সক্রিয় নয়'};
 const c=await cfg(),a=(await q('select in_t,out_t from attendance where d=$1 and code=$2',[now(c.Timezone).date,s.code]))[0]||{},w=await shiftOf(s);
 return{ok:true,name:s.name,designation:s.designation,branch:s.branch,shift:w.start+' - '+w.end,in:a.in_t||'',out:a.out_t||''}},
async punch(code,pin,type,lat,lng,acc){const s=await findStaff(code),c=await cfg();
 if(!s||S(s.pin).trim()!==S(pin).trim())return{ok:false,message:'PIN সঠিক নয়'};if(!active(s))return{ok:false,message:'স্টাফ সক্রিয় নয়'};
 lat=Number(lat);lng=Number(lng);acc=Number(acc)||0;if(!lat||!lng)return{ok:false,message:'লোকেশন পাওয়া যায়নি'};
 if(acc>(Number(c.MaxAccuracy)||100))return{ok:false,message:'GPS নির্ভুল নয় ('+Math.round(acc)+' মি)। মোবাইল থেকে হাজিরা দিন; কম্পিউটারে GPS থাকে না'};
 const b=(await q('select * from branches where branch=$1',[s.branch]))[0];if(!b||!Number(b.lat)||!Number(b.lng))return{ok:false,message:'এই শাখার লোকেশন সেট করা নেই'};
 const d=Math.round(dist(lat,lng,Number(b.lat),Number(b.lng)));if(d>(Number(b.radius)||150))return{ok:false,message:'আপনি শাখা থেকে '+d+' মিটার দূরে আছেন'};
 const n=now(c.Timezone),a=(await q('select * from attendance where d=$1 and code=$2',[n.date,s.code]))[0];
 if(type==='IN'){if(a&&a.in_t)return{ok:false,message:'আজ আপনি '+a.in_t+'-এ IN দিয়েছেন'};
  await q(`insert into attendance(d,code,name,branch,in_t,in_dist,source,upd) values($1,$2,$3,$4,$5,$6,'Mobile',$7) on conflict(d,code) do update set in_t=$5,in_dist=$6,upd=$7`,[n.date,s.code,s.name,s.branch,n.time,String(d),n.ts]);}
 else{if(!a||!a.in_t)return{ok:false,message:'আগে IN দিন'};await q('update attendance set out_t=$3,out_dist=$4,upd=$5 where d=$1 and code=$2',[n.date,s.code,n.time,String(d),n.ts]);}
 return{ok:true,message:type+' সফল হয়েছে: '+n.time}},
async adminData(p,month){auth(p);const c=await cfg(),o={month,today:now(c.Timezone).date,tabs:{},att:[]};
 for(const n of Object.keys(T))o.tabs[n]=await sheet(n);
 (await q('select d,code,in_t,out_t,note from attendance where d like $1',[month+'%'])).forEach(r=>o.att.push({d:r.d,c:r.code,in:r.in_t||'',out:r.out_t||'',note:r.note||''}));return o},
async adminSetRow(p,n,row,arr){auth(p);const m=T[n];if(!m)throw new Error('অনুমোদিত নয়');const v=m.c.map((_,i)=>S(arr[i]).trim());
 if(row>0)await q(`update ${m.t} set ${m.c.map((c,i)=>c+'=$'+(i+1)).join(',')} where id=$${m.c.length+1}`,[...v,row]);
 else await q(`insert into ${m.t}(${m.c.join(',')}) values(${m.c.map((_,i)=>'$'+(i+1)).join(',')})`,v);return{ok:true}},
async adminDelRow(p,n,row){auth(p);if(!T[n]||n==='Settings')throw new Error('অনুমোদিত নয়');await q(`delete from ${T[n].t} where id=$1`,[row]);return{ok:true}},
async adminSavePunch(p,code,date,tin,tout,note){auth(p);const s=await findStaff(code);if(!s)throw new Error('স্টাফ পাওয়া যায়নি');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('তারিখ দিন');
 await q(`insert into attendance(d,code,name,branch,in_t,out_t,source,note,upd) values($1,$2,$3,$4,$5,$6,'Manual',$7,$8) on conflict(d,code) do update set in_t=$5,out_t=$6,source='Manual',note=$7,upd=$8`,[date,s.code,s.name,s.branch,tin||'',tout||'',note||'',new Date().toISOString()]);return{ok:true}}};
export default async function handler(req,res){try{if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 const{fn,args=[]}=req.body||{};if(!F[fn])throw new Error('অজানা অনুরোধ');res.json({data:await F[fn](...args)})}catch(e){res.json({error:e.message})}}
