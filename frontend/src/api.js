import axios from 'axios';import {io} from 'socket.io-client';
export const api=axios.create({baseURL:import.meta.env.VITE_API||'http://localhost:4000/api'});
api.interceptors.request.use(c=>{const t=localStorage.getItem('token');if(t)c.headers.Authorization='Bearer '+t;return c});
api.interceptors.response.use(r=>r,e=>{if(e.response?.status===401&&!location.pathname.match(/^\/(login|new|ticket)/)){localStorage.removeItem('token');location.href='/login'}return Promise.reject(e)});
export const socket=io(import.meta.env.VITE_SOCKET||'http://localhost:4000');
export const errMsg=e=>e.response?.data?.error||e.message;
