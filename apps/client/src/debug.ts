import {CONFIG} from '@rally/shared/config';
import {Game,clamp,type RacketInput,type Power} from './engine';
interface DebugContext{game:()=>Game;local:()=>boolean;playing:()=>boolean;reset:()=>void}
export class DebugController{
 enabled=new URLSearchParams(location.search).has('debug');visible=this.enabled;input:RacketInput|null=null;panel:HTMLElement|null=null;readout:HTMLElement|null=null;
 constructor(private context:DebugContext){if(!this.enabled)return;
  const panel=document.createElement('aside');panel.id='debug-panel';panel.className='debug-panel';panel.innerHTML='<b>SIMULATOR <small>D TO HIDE</small></b><pre id="debug-readout"></pre><div class="debug-actions"><button data-action="serve">Serve</button><button data-action="mega">Big Racket</button><button data-action="smash">Smash</button><button data-action="shield">Shield</button><button data-action="giant">Giga Ball</button><button data-action="clone">Decoy Ball</button><button data-action="target">Target</button><button data-action="point">Score point</button><button data-action="reset">Reset</button></div><small>Mouse: racket · Space: serve · 1–5: powers<br>P: target · R: reset · 7: point<br>Power and score tools apply only to local practice.</small>';document.body.append(panel);this.panel=panel;this.readout=panel.querySelector('pre');
  panel.querySelectorAll<HTMLButtonElement>('button').forEach(button=>button.onclick=()=>this.action(button.dataset.action!));
  window.addEventListener('pointermove',e=>{if(!context.playing()||panel.contains(e.target as Node))return;const canvas=document.getElementById('arena');if(!canvas)return;const rect=canvas.getBoundingClientRect();this.input={x:clamp(((e.clientX-rect.left)/rect.width-.5)*3.4,-1.7,1.7),y:clamp(1.03+(1-(e.clientY-rect.top)/rect.height)*1.67,1.03,2.7),swing:1,tilt:0,speed:2.3,swingAge:0,extension:.9,motionX:1,motionY:.3};});
  window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes((e.target as HTMLElement).tagName))return;const actions:Record<string,string>={Space:'serve',Digit1:'mega',Digit2:'smash',Digit3:'shield',Digit4:'giant',Digit5:'clone',KeyP:'target',KeyR:'reset',Digit7:'point'};if(e.code==='KeyD'){this.visible=!this.visible;panel.hidden=!this.visible;e.stopImmediatePropagation();e.preventDefault();}else if(actions[e.code]&&context.playing()&&context.local()){e.preventDefault();e.stopImmediatePropagation();this.action(actions[e.code]);}},true);
 }
 action(action:string){if(!this.context.playing()||!this.context.local())return;const game=this.context.game();
  if(['mega','smash','shield','giant','clone'].includes(action))game.activate(action as Power,0);
  if(action==='serve'){game.balls=[game.newBall()];game.serve=.1;}
  if(action==='target'){game.boxes=[{x:0,y:CONFIG.TABLE_Y+.02,z:-1.4,id:99,phase:0,power:'mega'}];}
  if(action==='point')game.point(1);
  if(action==='reset')this.context.reset();
 }
 tick(data:{dt:number;cvFps:number;connected:boolean;rtt:number;side:number;confidence:number;speed:number;elbow:number;tracking:string}){if(!this.readout||!this.visible)return;const g=this.context.game(),r=g.rackets[data.side],b=g.balls[0];this.readout.textContent=`FPS ${Math.round(1/Math.max(.001,data.dt))} · CV ${data.cvFps}\nSocket ${data.connected?'connected':'local'} · RTT ${data.rtt}ms\nTracking ${data.tracking}\nPlayer ${data.side+1} · confidence ${Math.round(data.confidence*100)}%\nRacket ${r.x.toFixed(2)}, ${r.y.toFixed(2)}\nWrist ${data.speed.toFixed(2)} · elbow ${Math.round(data.elbow)}°\nBall ${b?[b.x,b.y,b.z].map(v=>v.toFixed(2)).join(', '):'—'}\nPower ${Object.keys(g.playerEffects[data.side]).join(', ')||'none'}`;}
}
