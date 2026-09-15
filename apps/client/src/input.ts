import { clamp, neutralInput, type RacketInput } from './engine';
export class KeyboardInput {
  keys=new Set<string>();targets=neutralInput();
  constructor(){window.addEventListener('keydown',e=>{if(['KeyW','KeyS','KeyA','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.code)){if(!['INPUT','TEXTAREA','BUTTON'].includes((e.target as HTMLElement).tagName))e.preventDefault();this.keys.add(e.code);}});window.addEventListener('keyup',e=>this.keys.delete(e.code));window.addEventListener('blur',()=>this.keys.clear());}
  update(dt:number){
    const codes=[['KeyA','KeyD','KeyW','KeyS','Space'],['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter']];
    this.targets.forEach((r,i)=>{const k=codes[i];r.x=clamp(r.x+((this.keys.has(k[1])?1:0)-(this.keys.has(k[0])?1:0))*3.4*dt,-1.7,1.7);r.y=clamp(r.y+((this.keys.has(k[2])?1:0)-(this.keys.has(k[3])?1:0))*2.8*dt,1.05,2.7);r.swing=this.keys.has(k[4])?1:Math.max(0,r.swing-dt*5);});return this.targets;
  }
}
export type HandPoint={x:number;y:number;z?:number};
export interface TrackedHand extends HandPoint {scale:number;tilt:number}
export function assignHands(hands:HandPoint[][]):(TrackedHand|null)[]{
  const selected:(TrackedHand|null)[]=[null,null];
  for(const landmarks of hands){const palm=landmarks[9]??landmarks[0],wrist=landmarks[0];if(!palm)continue;
    const a=landmarks[5]??palm,b=landmarks[17]??wrist;
    const p:TrackedHand={x:1-palm.x,y:palm.y,z:palm.z??0,scale:Math.hypot(palm.x-wrist.x,palm.y-wrist.y),tilt:clamp(-(a.y-b.y)*5,-.75,.75)};
    const side=p.x<.5?0:1;if(!selected[side]||Math.abs(p.x-(side?.75:.25))<Math.abs(selected[side]!.x-(side?.75:.25)))selected[side]=p;
  }return selected;
}
export function handToRacket(p:TrackedHand,side:number,previous?:TrackedHand|null,dt=.065):RacketInput {
  const localX=(p.x-side*.5)*2;
  const speed=previous?Math.hypot(p.x-previous.x,p.y-previous.y)/Math.max(dt,.03):0;
  const forward=previous?Math.max(0,p.scale-previous.scale)/Math.max(dt,.03):0;
  return {x:clamp((localX-.5)*4.3,-1.7,1.7),y:1.03+clamp((.84-p.y)/.68,0,1)*1.65,swing:clamp(speed*.55+forward*5,0,1),tilt:p.tilt};
}
