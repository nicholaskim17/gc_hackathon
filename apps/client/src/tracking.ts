import {PoseInput,type PoseResult} from './pose';
import {neutralInput} from './engine';
import {scoreForm,type FormHit} from './form';
export class Tracking{
 stream:MediaStream|null=null;worker:Worker|null=null;ready=false;busy=false;lastFrame=0;generation=0;seen=0;result:PoseResult|null=null;input=neutralInput()[0];mapper=new PoseInput();status='Camera is off';error=false;timeout:ReturnType<typeof setTimeout>|null=null;
 private sequences=new Map<number,number>();
 get history(){return this.mapper.history;}
 associateSequence(sequence:number){if(this.result?.calibrated){this.sequences.set(sequence,this.result.sequence);if(this.sequences.size>90)this.sequences.delete(this.sequences.keys().next().value!);}}
 scoreHit(hit:FormHit){const sequence=this.sequences.get(hit.inputSequence);return sequence===undefined?null:scoreForm(hit,this.history,sequence);}
 constructor(public video:HTMLVideoElement){}
 async start(){this.stop();const generation=this.generation;this.status='Allow camera access to join the court';this.error=false;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera needs HTTPS or localhost. Open this app on localhost on each laptop, or use a keyboard.');
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360},frameRate:{ideal:30},facingMode:'user'},audio:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.video.srcObject=stream;await this.video.play();if(generation!==this.generation)return;
   this.status='Warming up motion tracking…';this.worker=new Worker(new URL('./tracking.worker.ts',import.meta.url),{type:'module'});
   this.timeout=setTimeout(()=>{if(generation===this.generation&&!this.ready)this.fail('Motion tracking took too long to load. Retry or use the keyboard.');},25000);
   this.worker.onmessage=e=>{
    if(e.data.type==='ready'){this.ready=true;this.status='Step into view. Keep your head, shoulders and arms visible.';if(this.timeout)clearTimeout(this.timeout);}
    if(e.data.type==='pose'){this.busy=false;this.result=this.mapper.update(e.data.landmarks,e.data.timestamp);this.status=({body:'Step into view. Keep your head, shoulders and arms visible.',hand:'Raise your playing hand and hold it there.',neutral:'Lower your hand comfortably in front of you. Hold still.',ready:'Ready — move your hand to rally!'})[this.result.calibrationStage];if(this.result.hand&&this.result.calibrated){this.seen=performance.now();this.input=this.result.input;}}
    if(e.data.type==='error')this.fail('Motion tracking couldn’t start. Retry the camera or use the keyboard.');
   };
   this.worker.onerror=()=>this.fail('Motion tracking couldn’t load. Retry the camera or use the keyboard.');
   this.worker.postMessage({type:'init',base:new URL(import.meta.env.BASE_URL,location.href).href});stream.getVideoTracks()[0].onended=()=>this.fail('Camera disconnected. Reconnect it or switch to keyboard.');
  }catch(e){if(generation!==this.generation)return;const name=(e as Error).name;this.fail(name==='NotAllowedError'?'Camera access wasn’t allowed. Enable it in your browser or play with the keyboard.':name==='NotFoundError'?'No camera found. Connect one, or use the keyboard.':name==='NotReadableError'?'Your camera is busy. Close other camera apps and retry.':(e as Error).message);}
 }
 fail(message:string){this.stop();this.error=true;this.status=message;}
 async tick(now:number){if(!this.ready||this.busy||now-this.lastFrame<32||this.video.readyState<2)return;this.busy=true;this.lastFrame=now;const generation=this.generation;
  try{const bitmap=await createImageBitmap(this.video);if(generation!==this.generation){bitmap.close();return;}this.worker?.postMessage({type:'frame',bitmap,timestamp:now},[bitmap]);}catch{if(generation===this.generation)this.busy=false;}
 }
 detected(now:number){return this.seen>0&&now-this.seen<500;}
 recalibrate(){this.sequences.clear();this.seen=0;this.result=null;this.mapper.reset();this.input=neutralInput()[0];}
 stop(){this.generation++;this.ready=false;this.busy=false;if(this.timeout)clearTimeout(this.timeout);this.worker?.terminate();this.worker=null;this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;this.video.srcObject=null;this.recalibrate();}
}
