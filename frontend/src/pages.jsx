import {useEffect,useState} from 'react';import {Link,useNavigate,useParams} from 'react-router-dom';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {BarChart,Bar,XAxis,YAxis,Tooltip,Legend,ResponsiveContainer,LineChart,Line,PieChart,Pie,Cell} from 'recharts';
import {api,socket,errMsg} from './api.js';
const get=(k,u,p)=>useQuery({queryKey:[k,p],queryFn:()=>api.get(u,{params:p}).then(r=>r.data)});
const band=c=>c>=100?['Self-heal ready','text-green-700']:c>=95?['Review article','text-blue-700']:c>=81?['Ask requestor','text-amber-700']:['Escalate','text-red-700'];
const Err=({e})=>e?<div className="err" role="alert">{errMsg(e)}</div>:null;

export function Login(){const nav=useNavigate();const [f,setF]=useState({email:'',password:''});
 const m=useMutation({mutationFn:()=>api.post('/auth/login',f).then(r=>r.data),onSuccess:d=>{localStorage.setItem('token',d.token);nav('/')}});
 return<form className="box max-w-md" onSubmit={e=>{e.preventDefault();m.mutate()}}><h2 className="h2">Analyst sign in</h2>
  <label className="lbl" htmlFor="em">Email</label><input id="em" className="fld" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
  <label className="lbl" htmlFor="pw">Password</label><input id="pw" type="password" className="fld" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/>
  <Err e={m.error}/><button className="btn">Sign in</button></form>}

const SC={OPEN:'#c77d00',AWAITING_REQUESTOR:'#1d5fa8',RESOLVED:'#1e7a34',ESCALATED:'#a61b1b',APPROVED:'#14375e',FAILED:'#6b6b6b'};
const ago=d=>{const m=Math.round((Date.now()-new Date(d))/60000);return m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago'};
const Card=({title,right,children,className=''})=><section className={`bg-white border border-neutral-300 rounded-md p-4 ${className}`}><div className="flex justify-between items-center mb-2"><h3 className="font-bold text-sm">{title}</h3>{right}</div>{children}</section>;
const Spark=({data,color})=><div style={{height:44}}><ResponsiveContainer><LineChart data={data}><Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>;

export function Dashboard(){const qc=useQueryClient();const [dept,setDept]=useState('');const [sel,setSel]=useState(null);
 const deps=get('deps','/departments'),tk=get('tickets','/tickets',{departmentId:dept||undefined}),au=get('audit','/audit'),list=tk.data||[],t=list.find(x=>x.id===sel);
 useEffect(()=>{const f=()=>qc.invalidateQueries({queryKey:['tickets']});socket.on('ticket:new',f);return()=>socket.off('ticket:new',f)},[qc]);
 const nw=list.filter(x=>x.isNew).length,cnt=s=>list.filter(x=>x.status===s).length;
 const open=x=>{setSel(x.id);if(x.isNew)api.post(`/tickets/${x.id}/seen`).then(()=>qc.invalidateQueries({queryKey:['tickets']}))};
 const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toDateString()});
 const series=f=>days.map(d=>({v:list.filter(x=>new Date(x.createdAt).toDateString()===d&&f(x)).length}));
 const KPI=[['New tickets',nw,series(()=>true),'#c77d00'],['Awaiting requestor',cnt('AWAITING_REQUESTOR'),series(x=>x.status==='AWAITING_REQUESTOR'),'#1d5fa8'],['Escalated',cnt('ESCALATED'),series(x=>x.status==='ESCALATED'),'#a61b1b']];
 const pie=Object.keys(SC).map(k=>({name:k.replace('_',' ').toLowerCase(),key:k,value:cnt(k)})).filter(x=>x.value),
  byDept=Object.entries(list.reduce((m,x)=>(m[x.department.name]=(m[x.department.name]||0)+1,m),{})).map(([name,count])=>({name,count})),
  active=list.filter(x=>!['RESOLVED','ESCALATED','APPROVED'].includes(x.status)),healed=cnt('RESOLVED');
 return<><h2 className="h2">Operations dashboard</h2>
  {nw>0&&<div className="border-l-8 border-amber bg-amber-50 px-4 py-2 mb-4" role="status"><span className="inline-block w-3 h-3 rounded-full bg-amber mr-2"/><b>{nw} new ticket{nw>1?'s':''} received.</b> Select a ticket to view the matched article and action.</div>}
  <label className="lbl" htmlFor="dp">Department queue</label><select id="dp" className="fld !w-64" value={dept} onChange={e=>{setDept(e.target.value);setSel(null)}}><option value="">All departments</option>{deps.data?.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
   {KPI.map(([l,v,d,c])=><Card key={l} title={l}><div className="flex items-end justify-between"><b className="text-3xl font-serif">{v}</b><div className="w-28"><Spark data={d} color={c}/></div></div><p className="text-xs text-neutral-600">Last 7 days</p></Card>)}
   <section className="bg-navy text-white rounded-md p-4"><p className="text-xs">Automatic resolution</p><b className="block text-3xl font-serif">{list.length?Math.round(healed/list.length*100):0}%</b><p className="text-sm">{healed} ticket{healed===1?'':'s'} resolved by Self-Heal</p></section></div>
  <div className="grid lg:grid-cols-[3fr_2fr] gap-4 mb-4">
   <Card title="All active tickets" right={<span className="text-xs text-neutral-600">{active.length} open</span>}><div className="max-h-96 overflow-y-auto space-y-2">
    {active.length?active.map(x=><button key={x.id} onClick={()=>open(x)} className={`w-full text-left border rounded-md p-3 ${sel===x.id?'border-navy bg-amber-50':'border-neutral-300'}`}>
     <div className="flex justify-between text-xs text-neutral-600"><span>{x.isNew&&<span className="inline-block w-2.5 h-2.5 rounded-full bg-amber mr-1"/>}{x.code} | {x.department.name}</span><span>{ago(x.createdAt)}</span></div>
     <p className="text-sm my-1">{x.description.slice(0,110)}</p>
     <div className="flex justify-between items-center text-xs"><span>{x.article?x.article.code+' - '+x.article.title:'No article matched'}</span><span className={`tag ${band(x.confidence)[1]}`}>{x.confidence}% | {band(x.confidence)[0]}</span></div></button>):<p className="text-sm">No active tickets.</p>}</div></Card>
   <Card title="Current tickets by status"><div style={{height:260}}><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={90} label={e=>e.value}>{pie.map(p=><Cell key={p.key} fill={SC[p.key]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div></Card></div>
  {t&&<div className="box" aria-live="polite"><Detail key={t.id} t={t}/></div>}
  <div className="grid lg:grid-cols-[3fr_2fr] gap-4">
   <Card title="Recent activity"><ul className="divide-y divide-neutral-200 text-sm">{au.data?.slice(0,6).map(r=><li key={r.id} className="py-2 flex justify-between gap-3"><span>{r.action}</span><span className="text-xs text-neutral-600 whitespace-nowrap">{ago(r.createdAt)}</span></li>)}</ul><Link to="/audit" className="text-sm underline text-blue-800">View full audit log</Link></Card>
   <Card title="Tickets by department"><div style={{height:230}}><ResponsiveContainer><BarChart data={byDept} layout="vertical" margin={{left:20}}><XAxis type="number" allowDecimals={false} fontSize={12}/><YAxis type="category" dataKey="name" fontSize={12} width={110}/><Tooltip/><Bar dataKey="count" fill="#14375e"/></BarChart></ResponsiveContainer></div></Card></div></>}

function Detail({t}){const qc=useQueryClient();const [note,setNote]=useState(t.note);
 const m=useMutation({mutationFn:([p,b])=>api.post(`/tickets/${t.id}/${p}`,b).then(r=>r.data),onSuccess:()=>qc.invalidateQueries({queryKey:['tickets']})});
 const done=['RESOLVED','ESCALATED','APPROVED','FAILED'].includes(t.status),a=t.article;
 return<><h3 className="font-bold mb-2">{t.code}: details</h3>
  <dl className="grid grid-cols-[8rem_1fr] gap-1 mb-3 text-sm"><dt className="font-semibold">Department</dt><dd>{t.department.name}</dd><dt className="font-semibold">Request</dt><dd>{t.description}</dd>
   <dt className="font-semibold">Article</dt><dd>{a?`${a.code} - ${a.title}`:'No match'}</dd><dt className="font-semibold">Confidence</dt><dd>{t.confidence}%<div className="h-3.5 border border-neutral-600 bg-white"><div className="h-full bg-navy" style={{width:t.confidence+'%'}}/></div></dd><dt className="font-semibold">Status</dt><dd>{t.status}</dd></dl>
  <Err e={m.error}/>
  {a&&<><p className="text-sm mb-2"><b>Summary:</b> {a.summary}</p>{t.confidence>=95&&<ol className="list-decimal ml-5 text-sm mb-3">{a.steps.map((s,i)=><li key={i}>{s}</li>)}</ol>}</>}
  {!done&&t.confidence===100&&<><button className="btn btn-go mr-2" onClick={()=>m.mutate(['self-heal'])}>Self-Heal</button><button className="btn btn-alt" onClick={()=>m.mutate(['escalate'])}>Send to support team</button></>}
  {!done&&t.confidence>=95&&t.confidence<100&&<><label className="lbl" htmlFor="nt">Analyst note (covers the remaining {100-t.confidence}%)</label><textarea id="nt" className="fld" value={note} onChange={e=>setNote(e.target.value)}/><button className="btn" onClick={()=>m.mutate(['note',{note}])}>Save note and approve</button><p className="text-xs text-neutral-600 mt-2">Self-Heal is enabled only at 100% confidence.</p></>}
  {t.confidence>=81&&t.confidence<95&&<><p className="text-sm mb-1">Questions sent to the requestor:</p><ol className="list-decimal ml-5 text-sm">{t.questions.map((q,i)=><li key={i}>{q}</li>)}</ol><p className="text-xs mt-2">Requestor reply link: /ticket/{t.id}</p></>}
  {!done&&t.confidence<81&&<><p className="text-sm mb-2">Confidence is below 81%. Escalate for manual handling.</p><button className="btn" onClick={()=>m.mutate(['escalate'])}>Escalate now</button></>}
  {a&&<div className="mt-4 pt-3 border-t border-neutral-300"><label className="lbl" htmlFor="fb">Record the correct article (for accuracy analytics)</label><FB t={t} m={m}/></div>}</>}
function FB({t,m}){const arts=get('articles','/articles');return<select id="fb" className="fld" defaultValue={t.actualArticleId||''} onChange={e=>e.target.value&&m.mutate(['feedback',{articleId:e.target.value}])}><option value="">Select article</option>{arts.data?.map(a=><option key={a.id} value={a.id}>{a.code} - {a.title}</option>)}</select>}

export function NewTicket(){const deps=get('deps','/departments');const [f,setF]=useState({description:'',departmentId:'',requester:''});
 const m=useMutation({mutationFn:()=>api.post('/tickets',f).then(r=>r.data)});
 return<><h2 className="h2">Raise a ticket</h2><form className="box max-w-2xl" onSubmit={e=>{e.preventDefault();m.mutate()}}>
  <label className="lbl" htmlFor="rd">Department</label><select id="rd" required className="fld" value={f.departmentId} onChange={e=>setF({...f,departmentId:e.target.value})}><option value="">Select department</option>{deps.data?.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
  <label className="lbl" htmlFor="rq">Your email (optional)</label><input id="rq" className="fld" value={f.requester} onChange={e=>setF({...f,requester:e.target.value})}/>
  <label className="lbl" htmlFor="ds">Describe the problem</label><textarea id="ds" required rows={5} className="fld" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/>
  <Err e={m.error}/><button className="btn" disabled={m.isPending}>Submit ticket</button>
  {m.data&&<div className="msg">Ticket {m.data.code} submitted. {m.data.status==='AWAITING_REQUESTOR'?<><Link className="underline" to={`/ticket/${m.data.id}`}>We need a little more information</Link>.</>:'Our team will update you.'}</div>}</form></>}

export function TicketReply(){const {id}=useParams();const q=useQuery({queryKey:['pub',id],queryFn:()=>api.get(`/tickets/${id}/public`).then(r=>r.data)});const [a,setA]=useState('');
 const m=useMutation({mutationFn:()=>api.post(`/tickets/${id}/reply`,{answer:a}).then(r=>r.data),onSuccess:()=>q.refetch()});
 if(q.error)return<Err e={q.error}/>;const t=q.data;if(!t)return null;
 return<><h2 className="h2">Ticket {t.code}</h2><div className="box max-w-2xl"><p className="mb-2">Status: <b>{t.status.replace('_',' ').toLowerCase()}</b></p>
  {t.status==='AWAITING_REQUESTOR'?<><p className="mb-2">Please answer these questions in one reply:</p><ol className="list-decimal ml-5 mb-3">{t.questions.map((x,i)=><li key={i}>{x}</li>)}</ol>
   <label className="lbl" htmlFor="an">Your answers</label><textarea id="an" rows={5} className="fld" value={a} onChange={e=>setA(e.target.value)}/><Err e={m.error}/><button className="btn" onClick={()=>m.mutate()} disabled={!a.trim()}>Send answers</button></>
   :<p>No further information is needed right now.</p>}</div></>}

export function KnowledgeBase(){const qc=useQueryClient();const arts=get('articles','/articles'),deps=get('deps','/departments'),cl=get('clients','/clients'),ca=get('categories','/categories');
 const [f,setF]=useState({code:'',title:'',summary:'',script:'',departmentId:'',clientId:'',categoryId:'',steps:''}),[nc,setNc]=useState(''),[ng,setNg]=useState('');
 const add=useMutation({mutationFn:()=>api.post('/articles',{...f,steps:f.steps.split('\n').filter(Boolean)}),onSuccess:()=>qc.invalidateQueries({queryKey:['articles']})});
 const mk=(p,v,k,s)=>useMutation({mutationFn:()=>api.post(p,{name:v}),onSuccess:()=>{qc.invalidateQueries({queryKey:[k]});s('')}});
 const addC=mk('/clients',nc,'clients',setNc),addG=mk('/categories',ng,'categories',setNg),S=k=>e=>setF({...f,[k]:e.target.value});
 return<><h2 className="h2">Knowledge base</h2><div className="overflow-x-auto border border-neutral-300 mb-4"><table className="tbl"><caption className="text-left font-bold p-2">Articles by business domain</caption>
  <thead><tr><th>Code</th><th>Domain</th><th>Client</th><th>Category</th><th>Title</th><th>Self-heal script</th></tr></thead><tbody>{arts.data?.map(a=><tr key={a.id}><td>{a.code}</td><td>{a.department.name}</td><td>{a.client?.name}</td><td>{a.category?.name}</td><td>{a.title}</td><td>{a.script||'None'}</td></tr>)}</tbody></table></div>
  <div className="grid md:grid-cols-2 gap-4"><form className="box" onSubmit={e=>{e.preventDefault();add.mutate()}}><h3 className="font-bold mb-2">Add an article</h3>
   <label className="lbl" htmlFor="c1">Code</label><input id="c1" required className="fld" value={f.code} onChange={S('code')}/>
   <label className="lbl" htmlFor="c2">Domain</label><select id="c2" required className="fld" value={f.departmentId} onChange={S('departmentId')}><option value="">Select</option>{deps.data?.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
   <label className="lbl" htmlFor="c3">Client</label><select id="c3" className="fld" value={f.clientId} onChange={S('clientId')}><option value="">None</option>{cl.data?.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
   <label className="lbl" htmlFor="c4">Category</label><select id="c4" className="fld" value={f.categoryId} onChange={S('categoryId')}><option value="">None</option>{ca.data?.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
   <label className="lbl" htmlFor="c5">Title</label><input id="c5" required className="fld" value={f.title} onChange={S('title')}/>
   <label className="lbl" htmlFor="c6">Summary</label><textarea id="c6" required className="fld" value={f.summary} onChange={S('summary')}/>
   <label className="lbl" htmlFor="c7">Steps (one per line)</label><textarea id="c7" className="fld" value={f.steps} onChange={S('steps')}/>
   <label className="lbl" htmlFor="c8">Approved script file name (optional)</label><input id="c8" className="fld" value={f.script} onChange={S('script')}/><Err e={add.error}/><button className="btn">Add article</button></form>
   <div className="box"><h3 className="font-bold mb-2">Add a client</h3><label className="lbl" htmlFor="n1">Client name</label><input id="n1" className="fld" value={nc} onChange={e=>setNc(e.target.value)}/><button className="btn mb-4" onClick={()=>addC.mutate()}>Add client</button>
    <h3 className="font-bold mb-2">Add a category</h3><label className="lbl" htmlFor="n2">Category name</label><input id="n2" className="fld" value={ng} onChange={e=>setNg(e.target.value)}/><button className="btn" onClick={()=>addG.mutate()}>Add category</button></div></div></>}

export function Analytics(){const q=get('an','/analytics'),d=q.data;if(!d)return null;
 return<><h2 className="h2">Accuracy analytics</h2><div className="grid grid-cols-2 border border-neutral-300 bg-white mb-4"><div className="p-3 border-r"><b className="block text-3xl font-serif">{d.accuracy??'-'}{d.accuracy!=null&&'%'}</b><span className="text-sm">Match accuracy</span></div><div className="p-3"><b className="block text-3xl font-serif">{d.reviewed}</b><span className="text-sm">Tickets with recorded correct article</span></div></div>
  <div className="box"><h3 className="font-bold mb-2">Tickets by status</h3><div style={{height:220}}><ResponsiveContainer><BarChart data={d.byStatus}><XAxis dataKey="status" fontSize={12}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" fill="#14375e"/></BarChart></ResponsiveContainer></div></div>
  <div className="overflow-x-auto border border-neutral-300"><table className="tbl"><caption className="text-left font-bold p-2">Confusion matrix: correct article (rows) against matched article (columns)</caption>
  <thead><tr><th>Correct \ Matched</th>{d.labels.map(l=><th key={l}>{l}</th>)}</tr></thead><tbody>{d.matrix.map((r,i)=><tr key={i}><th>{d.labels[i]}</th>{r.map((v,j)=><td key={j} className={i===j?'font-bold bg-slate-200':''}>{v}</td>)}</tr>)}</tbody></table></div></>}

export function Audit(){const q=get('audit','/audit');
 return<><h2 className="h2">Audit log</h2><div className="overflow-x-auto border border-neutral-300"><table className="tbl"><caption className="text-left font-bold p-2">Actions recorded by the system and analysts</caption>
  <thead><tr><th>Date and time</th><th>Actor</th><th>Ticket</th><th>Action</th></tr></thead><tbody>{q.data?.map(r=><tr key={r.id}><td>{new Date(r.createdAt).toLocaleString()}</td><td>{r.actor}</td><td>{r.ticketId||''}</td><td>{r.action}</td></tr>)}</tbody></table></div></>}
