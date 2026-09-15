import {describe,it,expect} from 'vitest';
import {Rooms} from '../apps/server/src/rooms';
import {CONFIG} from '@rally/shared';
const packet={x:0,y:1.5,swing:0,tilt:0,ready:true,sequence:1};
describe('single table and session recovery',()=>{
 it('allows only two distinct players and one table',()=>{const rooms=new Rooms(),r=rooms.create('a','a');expect(()=>rooms.create('x','x')).toThrow();expect(rooms.join('', 'b','b').side).toBe(1);expect(()=>rooms.join(r.code,'c','c')).toThrow();});
 it('recovers the same seat after a short disconnect',()=>{const rooms=new Rooms(),r=rooms.create('a','old');rooms.disconnect(r,0);expect(rooms.join(r.code,'a','new').side).toBe(0);expect(r.players[0]?.socketId).toBe('new');});
 it('rejects repeated and invalid input sequences',()=>{const rooms=new Rooms(),r=rooms.create('a','a');rooms.input(r,0,packet);rooms.input(r,0,{...packet,x:1});expect(r.players[0]?.input.x).toBe(0);rooms.input(r,0,{...packet,sequence:2,x:NaN});expect(r.players[0]?.sequence).toBe(1);});
 it('pauses simulation when a player disconnects',()=>{const rooms=new Rooms(),r=rooms.create('a','a');rooms.join(r.code,'b','b');rooms.input(r,0,packet);rooms.input(r,1,packet);rooms.tick(r,3.1);expect(r.phase).toBe('playing');rooms.disconnect(r,1);const elapsed=r.game.elapsed;rooms.tick(r,.05);expect(r.phase).toBe('paused');expect(r.game.elapsed).toBe(elapsed);});
 it('allows scene startup stalls but still pauses stale input during play',()=>{const rooms=new Rooms(),r=rooms.create('a','a'),started=Date.now();rooms.join(r.code,'b','b');rooms.input(r,0,packet,started);rooms.input(r,1,packet,started);rooms.tick(r,.1,started+2500);expect(r.phase).toBe('countdown');r.phase='playing';rooms.tick(r,.1,started+CONFIG.INPUT_TIMEOUT_MS+500);expect(r.phase).toBe('paused');});
 it('releases seats on explicit leave',()=>{const rooms=new Rooms(),r=rooms.create('a','a');rooms.leave(r,0);expect(rooms.rooms.size).toBe(0);});
});
