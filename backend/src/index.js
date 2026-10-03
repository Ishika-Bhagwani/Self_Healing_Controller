import 'dotenv/config';import express from 'express';import cors from 'cors';import http from 'http';import {Server} from 'socket.io';
import jwt from 'jsonwebtoken';import bcrypt from 'bcryptjs';import {PrismaClient} from '@prisma/client';
import {execFile} from 'child_process';import path from 'path';import fs from 'fs';
const origins=(process.env.FRONTEND_URL||'').split(',').filter(Boolean);
const corsOpt=origins.length?{origin:origins}:{origin:true};const db=new PrismaClient(),app=express(),srv=http.createServer(app),io=new Server(srv,{cors:{origin:corsOpt}});
app.use(cors(corsOpt),express.json());
const AI=process.env.AI_URL||'http://127.0.0.1:8000',inc={article:true,department:true};
const asArray=(v)=>{try{const p=JSON.parse(v ?? '[]');return Array.isArray(p)?p:[]}catch{return []}};
const asJson=(v)=>JSON.stringify(Array.isArray(v)?v:[]);
const ai=async(p,b)=>{const r=await fetch(AI+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});if(!r.ok)throw new Error('AI service unavailable');return r.json()};
const decide=c=>c>=100?'SELF_HEAL':c>=95?'REVIEW':c>=81?'CLARIFY':'ESCALATE';
const audit=(actor,action,ticketId)=>db.auditLog.create({data:{actor,action,ticketId}});
const auth=(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').replace('Bearer ',''),process.env.JWT_SECRET);n()}catch{s.status(401).json({error:'Sign in required'})}};
const wrap=f=>(q,s)=>f(q,s).catch(e=>s.status(500).json({error:e.message}));
const match=async(t,text)=>{const a=await db.article.findMany({where:{departmentId:t.departmentId}});
  if(!a.length)return{articleId:null,confidence:0};
  const m=await ai('/match',{text,articles:a.map(x=>({id:x.id,text:x.title+'. '+x.summary}))});return{articleId:m.id,confidence:m.confidence}};
const questionsFor=async t=>{const a=await db.article.findUnique({where:{id:t.articleId}});return(await ai('/questions',{text:t.description,article:a.title+'. '+a.summary})).questions};
const statusOf=a=>a==='ESCALATE'?'ESCALATED':a==='CLARIFY'?'AWAITING_REQUESTOR':'OPEN';
const one=async id=>{const t=await db.ticket.findUnique({where:{id:+id},include:inc}); if(!t)return null; return {...t, questions:asArray(t.questions), article:t.article?{...t.article,steps:asArray(t.article.steps)}:null};};

app.post('/api/auth/login',wrap(async(q,s)=>{const u=await db.user.findUnique({where:{email:q.body.email||''}});
  if(!u||!await bcrypt.compare(q.body.password||'',u.password))return s.status(401).json({error:'Email or password is incorrect'});
  s.json({token:jwt.sign({id:u.id,email:u.email},process.env.JWT_SECRET,{expiresIn:'8h'}),email:u.email})}));
app.get('/api/departments',wrap(async(q,s)=>s.json(await db.department.findMany())));

app.post('/api/tickets',wrap(async(q,s)=>{const{description,departmentId,requester}=q.body;
  if(!description||!departmentId)return s.status(400).json({error:'Description and department are required'});
  let t=await db.ticket.create({data:{description,departmentId:+departmentId,requester}});
  const m=await match(t,description),act=decide(m.confidence);
  t=await db.ticket.update({where:{id:t.id},data:{...m,code:'TKT-'+(1000+t.id),status:statusOf(act)}});
  if(act==='CLARIFY')t=await db.ticket.update({where:{id:t.id},data:{questions:asJson(await questionsFor(t))}});
  await audit('system',`Matched to ${m.articleId?'article '+m.articleId:'no article'} at ${m.confidence}% (${act})`,t.id);
  t=await one(t.id);io.emit('ticket:new',t);s.json(t)}));
app.get('/api/tickets/:id/public',wrap(async(q,s)=>{const t=await db.ticket.findUnique({where:{id:+q.params.id}});
  t?s.json({id:t.id,code:t.code,status:t.status,questions:asArray(t.questions)}):s.status(404).json({error:'Ticket not found'})}));
app.post('/api/tickets/:id/reply',wrap(async(q,s)=>{let t=await db.ticket.findUnique({where:{id:+q.params.id}});
  if(!t||t.status!=='AWAITING_REQUESTOR')return s.status(400).json({error:'This ticket is not waiting for a reply'});
  const description=t.description+'\n'+(q.body.answer||''),m=await match(t,description);let act=decide(m.confidence);
  if(act==='CLARIFY')act='ESCALATE'; // still in the 81-94 band after the loop: move to next step
  t=await db.ticket.update({where:{id:t.id},data:{...m,description,rounds:t.rounds+1,status:statusOf(act),isNew:true}});
  await audit('requestor',`Clarification received, rematched at ${m.confidence}% (${act})`,t.id);
  io.emit('ticket:new',t);s.json({status:t.status,confidence:t.confidence})}));

app.get('/api/tickets',auth,wrap(async(q,s)=>{const items=await db.ticket.findMany({where:q.query.departmentId?{departmentId:+q.query.departmentId}:{},include:inc,orderBy:{id:'desc'}}); s.json(items.map(t=>({...t,questions:asArray(t.questions),article:t.article?{...t.article,steps:asArray(t.article.steps)}:null})))}));
app.post('/api/tickets/:id/seen',auth,wrap(async(q,s)=>s.json(await db.ticket.update({where:{id:+q.params.id},data:{isNew:false}}))));
app.post('/api/tickets/:id/note',auth,wrap(async(q,s)=>{const t=await one(q.params.id);
  if(!t||t.confidence<95)return s.status(400).json({error:'Override applies to matches of 95% or more'});
  await db.ticket.update({where:{id:t.id},data:{note:q.body.note||'',status:'APPROVED'}});await audit(q.user.email,`Approved with note: ${q.body.note||'none'}`,t.id);s.json(await one(t.id))}));
app.post('/api/tickets/:id/escalate',auth,wrap(async(q,s)=>{await db.ticket.update({where:{id:+q.params.id},data:{status:'ESCALATED'}});
  await audit(q.user.email,'Escalated to production support',+q.params.id);s.json(await one(q.params.id))}));
app.post('/api/tickets/:id/feedback',auth,wrap(async(q,s)=>{await db.ticket.update({where:{id:+q.params.id},data:{actualArticleId:+q.body.articleId}});
  await audit(q.user.email,`Recorded correct article ${q.body.articleId}`,+q.params.id);s.json(await one(q.params.id))}));
app.post('/api/tickets/:id/self-heal',auth,wrap(async(q,s)=>{const t=await one(q.params.id);
  if(!t||t.confidence!==100||!t.article)return s.status(400).json({error:'Self-Heal needs a 100% match'});
  const sc=t.article.script;if(!sc||!new Set(fs.readdirSync(path.resolve('scripts'))).has(sc))return s.status(400).json({error:'No approved script for this article'});
  execFile('sh',[path.resolve('scripts',sc),t.code],{timeout:30000},async(err,out)=>{
    const ok=!err;await db.ticket.update({where:{id:t.id},data:{status:ok?'RESOLVED':'FAILED'}});
    await audit(q.user.email,`Self-Heal ${sc} ${ok?'succeeded':'failed'}: ${(err?err.message:out).trim()}`,t.id);s.json(await one(t.id))})}));

app.get('/api/articles',auth,wrap(async(q,s)=>{const items=await db.article.findMany({include:{department:true,client:true,category:true},orderBy:{id:'asc'}});s.json(items.map(a=>({...a,steps:asArray(a.steps)})))}));
app.post('/api/articles',auth,wrap(async(q,s)=>{const{code,title,summary,steps,script,departmentId,clientId,categoryId}=q.body;
  if(!code||!title||!summary||!departmentId)return s.status(400).json({error:'Code, title, summary and department are required'});
  const a=await db.article.create({data:{code,title,summary,steps:asJson(steps),script:script||null,departmentId:+departmentId,clientId:clientId?+clientId:null,categoryId:categoryId?+categoryId:null}});
  await audit(q.user.email,`Added article ${code}`);s.json({...a,steps:asArray(a.steps)});
}));
for(const[k,m]of[['clients','client'],['categories','category']]){
  app.get('/api/'+k,auth,wrap(async(q,s)=>s.json(await db[m].findMany())));
  app.post('/api/'+k,auth,wrap(async(q,s)=>{if(!q.body.name)return s.status(400).json({error:'Name is required'});s.json(await db[m].create({data:{name:q.body.name}}))}));
}
app.get('/api/analytics',auth,wrap(async(q,s)=>{const ts=await db.ticket.findMany({where:{actualArticleId:{not:null}}}),arts=await db.article.findMany(),L=arts.map(a=>a.id);
  const M=L.map(()=>L.map(()=>0));ts.forEach(t=>{const i=L.indexOf(t.actualArticleId),j=L.indexOf(t.articleId);if(i>=0&&j>=0)M[i][j]++});
  const ok=ts.filter(t=>t.actualArticleId===t.articleId).length,g=await db.ticket.groupBy({by:['status'],_count:true});
  s.json({labels:arts.map(a=>a.code),matrix:M,reviewed:ts.length,accuracy:ts.length?Math.round(ok/ts.length*100):null,byStatus:g.map(x=>({status:x.status,count:x._count}))})}));
app.get('/api/audit',auth,wrap(async(q,s)=>s.json(await db.auditLog.findMany({orderBy:{id:'desc'},take:200}))));
srv.listen(process.env.PORT||4000,()=>console.log('Backend on :'+(process.env.PORT||4000)));
