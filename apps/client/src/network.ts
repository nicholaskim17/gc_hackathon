import {io,type Socket} from 'socket.io-client';
import {Game,type RacketInput,type GameEvent} from './engine';
import type {Snapshot} from '@rally/shared/protocol';
import {CONFIG} from '@rally/shared/config';
export type {Snapshot};
export class Network{
 socket:Socket|null=null;side=0;code='';latest:Snapshot|null=null;connected=false;error='';lastReceived=0;rtt=0;addresses:string[]=[];
 onUpdate:(s:Snapshot)=>void=()=>{};onEvents:(events:GameEvent[])=>void=()=>{};buffer:{time:number;data:Snapshot}[]=[];
 token:string;
 constructor(){let token='';try{token=localStorage.getItem('rally-client-id')??'';}catch{}this.token=token||crypto.randomUUID();try{localStorage.setItem('rally-client-id',this.token);}catch{}}
 async connect(url:string,kind:'create'|'join',code=''){
  this.close();this.error='';this.latest=null;
  let parsed:URL;try{parsed=new URL(url);}catch{throw new Error('Enter a server address, such as http://192.168.1.10:3001.');}if(!['http:','https:'].includes(parsed.protocol))throw new Error('Use an http or https server address.');
  const socket=io(parsed.origin,{autoConnect:false,timeout:7000,reconnection:true});this.socket=socket;let joined=false;
  socket.on('snapshot',(s:Snapshot)=>{this.latest=s;this.lastReceived=performance.now();this.buffer.push({time:performance.now(),data:s});if(this.buffer.length>8)this.buffer.shift();this.onUpdate(s);});
  socket.on('events',(events:GameEvent[])=>this.onEvents(events));
  socket.on('disconnect',()=>{this.connected=false;this.error='Connection lost. Reconnecting…';});
  socket.on('connect',()=>{this.connected=true;this.error='';if(joined)socket.emit('join',{code:this.code,token:this.token},(r:{error?:string})=>{if(r.error)this.error=r.error;});});
  socket.on('connect_error',()=>{this.error='Can’t reach the game server. Check the address, Wi-Fi, and that the server is running.';});
  return new Promise<void>((resolve,reject)=>{
   const timeout=setTimeout(()=>{if(!joined){socket.disconnect();reject(new Error(this.error||'The server didn’t answer. Check its address.'));}},9000);
   socket.once('connect',()=>socket.emit(kind,{token:this.token,code},(result:{error?:string;code:string;side:number;addresses?:string[]})=>{clearTimeout(timeout);if(result.error){socket.disconnect();reject(new Error(result.error));return;}this.code=result.code;this.side=result.side;this.addresses=result.addresses??[];joined=true;try{localStorage.setItem('rally-last-room',JSON.stringify({server:parsed.origin,code:this.code}));localStorage.setItem('rally-server',parsed.origin);}catch{}resolve();}));socket.connect();
  });
 }
 send(input:RacketInput,ready:boolean){if(this.connected)this.socket?.volatile.emit('input',{...input,ready});}
 sample(now:number):Game|null{
  if(!this.latest)return null;const game=Object.assign(new Game(),this.latest.game);const target=now-CONFIG.NETWORK_INTERPOLATION_MS;
  const a=[...this.buffer].reverse().find(v=>v.time<=target),b=this.buffer.find(v=>v.time>target);
  if(a&&b){const alpha=Math.min(1,(target-a.time)/(b.time-a.time));game.balls=this.latest.game.balls.map((ball,i)=>{const old=a.data.game.balls[i],next=b.data.game.balls[i];if(!old||!next||old.lastSide!==next.lastSide||Math.abs(old.z-next.z)>1)return{...ball};return{...ball,x:old.x+(next.x-old.x)*alpha,y:old.y+(next.y-old.y)*alpha,z:old.z+(next.z-old.z)*alpha};});game.rackets=this.latest.game.rackets.map((r,i)=>{const old=a.data.game.rackets[i],next=b.data.game.rackets[i];return{...r,x:old.x+(next.x-old.x)*alpha,y:old.y+(next.y-old.y)*alpha};});}
  else{game.rackets=game.rackets.map(r=>({...r}));game.balls=game.balls.map(b=>({...b}));}
  return game;
 }
 submitForm(hitId:string,score:number){if(Number.isFinite(score))this.socket?.emit('form_result',{hitId,score:Math.max(0,Math.min(100,score))});}
 ping(){const start=performance.now();this.socket?.timeout(1500).emit('latency',Date.now(),(error:Error|null)=>{if(!error)this.rtt=Math.round(performance.now()-start);});}
 pause(){this.socket?.emit('pause');}resume(){this.socket?.emit('resume');}replay(){this.socket?.emit('replay');}
 suspend(){this.socket?.disconnect();this.connected=false;}
 close(){this.socket?.emit('leave');this.socket?.disconnect();this.socket=null;this.connected=false;this.buffer=[];this.code='';}
}
