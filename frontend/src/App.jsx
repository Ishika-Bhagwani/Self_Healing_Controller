import {NavLink,Navigate,Route,Routes,useNavigate} from 'react-router-dom';import {Bell} from 'lucide-react';
import {Login,Dashboard,NewTicket,TicketReply,KnowledgeBase,Analytics,Audit} from './pages.jsx';
const links=[['/','Operations dashboard'],['/new','Raise a ticket'],['/kb','Knowledge base'],['/analytics','Accuracy analytics'],['/audit','Audit log']];
const Guard=({children})=>localStorage.getItem('token')?children:<Navigate to="/login" replace/>;
export default function App(){const nav=useNavigate();
 return<>
  <a href="#main" className="absolute -left-[999px] focus:left-0 bg-white p-2">Skip to main content</a>
  <div className="bg-navy2 text-white text-xs"><div className="max-w-6xl mx-auto px-4 py-1 flex justify-between"><span>IT Service Management Directorate | Internal use only</span>
   {localStorage.getItem('token')&&<button onClick={()=>{localStorage.removeItem('token');nav('/login')}}>Sign out</button>}</div></div>
  <header className="bg-white border-b-4 border-navy"><div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
   <div className="w-14 h-14 rounded-full border-4 border-double border-navy grid place-items-center font-bold text-navy font-serif" aria-hidden>SHC</div>
   <div><h1 className="font-serif text-2xl font-bold text-navy">Self-Healing Controller</h1><p className="text-sm text-neutral-600">Automated ticket matching and remediation for IT support</p></div>
   <Bell className="ml-auto text-navy" aria-hidden size={20}/></div></header>
  <nav className="bg-navy text-white" aria-label="Main"><div className="max-w-6xl mx-auto flex flex-wrap">
   {links.map(([to,l])=><NavLink key={to} to={to} end={to==='/'} className={({isActive})=>`px-4 py-2.5 border-r border-[#35557c] text-sm ${isActive?'bg-white text-navy font-bold':''}`}>{l}</NavLink>)}</div></nav>
  <main id="main" className="max-w-6xl mx-auto px-4 py-5">
   <Routes><Route path="/login" element={<Login/>}/><Route path="/new" element={<NewTicket/>}/><Route path="/ticket/:id" element={<TicketReply/>}/>
    <Route path="/" element={<Guard><Dashboard/></Guard>}/><Route path="/kb" element={<Guard><KnowledgeBase/></Guard>}/>
    <Route path="/analytics" element={<Guard><Analytics/></Guard>}/><Route path="/audit" element={<Guard><Audit/></Guard>}/></Routes></main></>}
