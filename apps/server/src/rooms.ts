import {randomBytes} from 'node:crypto';
import {Game,clamp,neutralInput,CONFIG,type RacketInput} from '@rally/shared';
export type Phase='lobby'|'countdown'|'playing'|'paused'|'results';
export interface Player{token:string;socketId:string|null;ready:boolean;lastInput:number;sequence:number;disconnectedAt?:number;input:RacketInput}
export interface Room{code:string;players:(Player|null)[];game:Game;phase:Phase;countdown:number;reason:string;updated:number;replays:Set<number>}
export class Rooms{
 rooms=new Map<string,Room>();
 create(token:string,socketId:string){this.expire(Date.now());if(this.rooms.size)throw new Error('A table is already open. Join the existing table.');let code='';do{code=randomBytes(3).toString('hex').slice(0,5).toUpperCase();}while(this.rooms.has(code));const room:Room={code,players:[{token,socketId,ready:false,lastInput:Date.now(),sequence:-1,input:neutralInput()[0]},null],game:new Game(Math.random,true),phase:'lobby',countdown:3,reason:'',updated:Date.now(),replays:new Set()};this.rooms.set(code,room);return room;}
 join(code:string,token:string,socketId:string){this.expire(Date.now());const room=code?this.rooms.get(code.toUpperCase()):this.rooms.values().next().value;if(!room)throw new Error('Room not found. Check the five-character code.');let side=room.players.findIndex(p=>p?.token===token);if(side<0)side=room.players.findIndex(p=>p===null);if(side<0)throw new Error('This room already has two players.');const previous=room.players[side];if(previous?.socketId&&previous.socketId!==socketId)throw new Error('That player is already connected in another tab.');room.players[side]={token,socketId,ready:false,lastInput:Date.now(),sequence:-1,input:previous?.input??neutralInput()[side]};room.updated=Date.now();return{room,side};}
 input(room:Room,side:number,payload:unknown,now=Date.now()){
  if(!payload||typeof payload!=='object')return;const data=payload as Record<string,unknown>,player=room.players[side];if(!player)return;if(!Number.isSafeInteger(data.sequence)||(data.sequence as number)<=player.sequence)return;
  for(const k of ['x','y','swing','tilt'])if(typeof data[k]!=='number'||!Number.isFinite(data[k]))return;
  const num=(k:string,fallback:number,a:number,b:number)=>typeof data[k]==='number'&&Number.isFinite(data[k])?clamp(data[k] as number,a,b):fallback;
  player.sequence=data.sequence as number;player.input={sequence:player.sequence,x:num('x',0,-1.72,1.72),y:num('y',1.5,1.03,2.7),swing:num('swing',0,0,1),tilt:num('tilt',0,-.8,.8),speed:num('speed',0,0,10),extension:num('extension',.7,0,1),swingAge:num('swingAge',1,0,10),motionX:num('motionX',0,-10,10),motionY:num('motionY',0,-10,10)};
  player.ready=data.ready===true;player.lastInput=now;room.updated=now;
 }
 disconnect(room:Room,side:number){const player=room.players[side];if(player){player.socketId=null;player.ready=false;player.disconnectedAt=Date.now();}if(room.phase==='playing'||room.phase==='countdown'){room.phase='paused';room.reason='Your opponent disconnected. Waiting for them to return.';}}
 leave(room:Room,side:number){this.disconnect(room,side);room.players[side]=null;if(!room.players.some(p=>p?.socketId))this.rooms.delete(room.code);else{room.phase='lobby';room.game=new Game(Math.random,true);}}
 expire(now:number){for(const [code,room] of this.rooms){room.players=room.players.map(p=>p&&!p.socketId&&now-(p.disconnectedAt??now)>CONFIG.SEAT_RECOVERY_MS?null:p);if(room.players.every(p=>p===null))this.rooms.delete(code);}}
 form(room:Room,side:number,payload:unknown){if(!payload||typeof payload!=='object')return false;const p=payload as Record<string,unknown>;return typeof p.hitId==='string'&&typeof p.score==='number'&&room.game.confirmForm(p.hitId,side,p.score);}
 bothReady(room:Room,now:number,timeout:number=CONFIG.INPUT_TIMEOUT_MS){return room.players.every(p=>p?.socketId&&p.ready&&now-p.lastInput<timeout);}
 resume(room:Room){if(room.phase!=='paused'||!this.bothReady(room,Date.now()))return false;room.phase='countdown';room.countdown=3;room.reason='';return true;}
 replay(room:Room,side:number){if(room.phase!=='results')return;room.replays.add(side);if(room.replays.size===2){room.game=new Game(Math.random,true);room.phase='lobby';room.replays.clear();room.countdown=3;}}
 tick(room:Room,dt:number,now=Date.now()){
  const ready=this.bothReady(room,now,room.phase==='lobby'||room.phase==='countdown'?CONFIG.STARTUP_INPUT_TIMEOUT_MS:CONFIG.INPUT_TIMEOUT_MS);
  if(room.phase==='lobby'&&ready){room.phase='countdown';room.countdown=3;}
  if((room.phase==='playing'||room.phase==='countdown')&&!ready){room.phase='paused';room.reason='Motion paused. Both players need to be ready.';}
  const inputs=room.players.map((p,i)=>p?.input??neutralInput()[i]);
  if(room.phase==='countdown'){room.game.updateRackets(dt,inputs);room.countdown-=dt;if(room.countdown<=0){room.countdown=0;room.phase='playing';}}
  else if(room.phase==='playing'){room.game.step(dt,inputs);if(room.game.ended)room.phase='results';}
  for(const [code,r] of this.rooms)if(now-r.updated>30*60*1000&&!r.players.some(p=>p?.socketId))this.rooms.delete(code);
 }
 snapshot(room:Room){return{code:room.code,phase:room.phase,countdown:room.countdown,reason:room.reason,players:room.players.map((p,i)=>({side:i,connected:!!p?.socketId,ready:!!p?.ready,replay:room.replays.has(i)})),game:{...room.game,events:[],pendingGrades:[]},serverTime:Date.now()};}
}
