import {CONFIG} from '@rally/shared';
import express from 'express';
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';
import {Server} from 'socket.io';
import {Rooms,type Room} from './rooms';
const app=express(),http=createServer(app),rooms=new Rooms();
const allowedOrigins=process.env.ALLOWED_ORIGINS?.split(',').map(s=>s.trim());
const io=new Server(http,{cors:{origin:allowedOrigins??true,methods:['GET','POST']},maxHttpBufferSize:8192});
app.get('/health',(_req,res)=>res.json({ok:true,rooms:rooms.rooms.size}));app.use(express.static('apps/client/dist'));
const addresses=()=>Object.values(networkInterfaces()).flatMap(list=>(list??[]).filter(a=>a.family==='IPv4'&&!a.internal).map(a=>`http://${a.address}:${Number(process.env.PORT??3001)}`));
const membership=new Map<string,{room:Room;side:number}>();
io.on('connection',socket=>{
 const join=(kind:'create'|'join',data:{token?:unknown;code?:unknown},reply:(data:unknown)=>void)=>{
  if(typeof reply!=='function')return;
  if(!data||typeof data.token!=='string'||data.token.length<16||data.token.length>100){reply({error:'Invalid session. Reload and try again.'});return;}
  if(membership.has(socket.id)){reply({error:'Leave your current room first.'});return;}
  try{const joined=kind==='create'?{room:rooms.create(data.token,socket.id),side:0}:rooms.join(String(data.code??'').slice(0,5),data.token,socket.id);membership.set(socket.id,joined);socket.join(joined.room.code);reply({code:joined.room.code,side:joined.side,addresses:addresses()});io.to(joined.room.code).emit('snapshot',rooms.snapshot(joined.room));}catch(e){reply({error:(e as Error).message});}
 };
 socket.on('create',(data,reply)=>join('create',data,reply));socket.on('join',(data,reply)=>join('join',data,reply));
 socket.on('input',data=>{const m=membership.get(socket.id);if(m)rooms.input(m.room,m.side,data);});
 socket.on('form_result',data=>{const m=membership.get(socket.id);if(m)rooms.form(m.room,m.side,data);});
 socket.on('latency',(timestamp,reply)=>{if(typeof reply==='function')reply(timestamp);});
 socket.on('ping_check',(reply)=>{if(typeof reply==='function')reply(Date.now());});
 socket.on('pause',()=>{const m=membership.get(socket.id);if(m&&(m.room.phase==='playing'||m.room.phase==='countdown')){m.room.phase='paused';m.room.reason=`Player ${m.side+1} called a time out.`;}});
 socket.on('resume',()=>{const m=membership.get(socket.id);if(m)rooms.resume(m.room);});
 socket.on('replay',()=>{const m=membership.get(socket.id);if(m)rooms.replay(m.room,m.side);});
 socket.on('leave',()=>{const m=membership.get(socket.id);if(m){rooms.leave(m.room,m.side);socket.leave(m.room.code);membership.delete(socket.id);}});
 socket.on('disconnect',()=>{const m=membership.get(socket.id);if(m){rooms.disconnect(m.room,m.side);membership.delete(socket.id);}});
});
let previous=performance.now(),accumulator=0,broadcast=0;
setInterval(()=>{const now=performance.now();accumulator+=Math.min(.1,(now-previous)/1000);previous=now;
 while(accumulator>=1/CONFIG.PHYSICS_HZ){for(const room of rooms.rooms.values())rooms.tick(room,1/CONFIG.PHYSICS_HZ);accumulator-=1/CONFIG.PHYSICS_HZ;}
 if(now-broadcast>=1000/CONFIG.STATE_BROADCAST_HZ){for(const room of rooms.rooms.values()){if(room.game.events.length)io.to(room.code).emit('events',room.game.events);io.to(room.code).emit('snapshot',rooms.snapshot(room));room.game.events=[];}broadcast=now;}
},8);
const port=Number(process.env.PORT??3001);http.listen(port,'0.0.0.0',()=>{console.log(`Rally multiplayer server: http://localhost:${port}`);for(const list of Object.values(networkInterfaces()))for(const address of list??[])if(address.family==='IPv4'&&!address.internal)console.log(`Teammate server address: http://${address.address}:${port}`);});
