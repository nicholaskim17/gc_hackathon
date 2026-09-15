export class Sound {
  context:AudioContext|null=null; muted=false;private buffers:Partial<Record<'paddle'|'bounce',AudioBuffer>>={};private loading:Promise<void>|null=null;
  async unlock(){try{this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();void this.loadSamples();}catch{/* Silent play remains available. */}}
  private loadSamples(){if(this.loading||!this.context)return this.loading;const context=this.context,base=new URL(import.meta.env.BASE_URL,location.href);
    this.loading=Promise.all(([['paddle','audio/paddle-hit.mp3'],['bounce','audio/table-bounce.mp3']] as const).map(async([name,path])=>{const response=await fetch(new URL(path,base));if(!response.ok)throw new Error(`Could not load ${path}`);this.buffers[name]=await context.decodeAudioData(await response.arrayBuffer());})).then(()=>{}).catch(()=>{/* Synthesized effects remain available if a sample cannot load. */});return this.loading;
  }
  private sample(name:'paddle'|'bounce',volume:number,rate=1){if(this.muted||!this.context||!this.buffers[name])return false;const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers[name]!;source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(this.context.destination);source.start();return true;}
  tone(freq:number,duration=.09,type:OscillatorType='sine',volume=.1,delay=0){
    if(this.muted||!this.context)return;const c=this.context,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,c.currentTime+delay);o.frequency.exponentialRampToValueAtTime(freq*.7,c.currentTime+delay+duration);
    g.gain.setValueAtTime(0,c.currentTime+delay);g.gain.linearRampToValueAtTime(volume,c.currentTime+delay+.006);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+duration);
    o.connect(g);g.connect(c.destination);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+duration);
  }
  hit(rally:number,slow=false){if(this.sample('paddle',.42,(slow?.82:1)+Math.min(.12,rally*.004)))return;this.tone((440+Math.min(300,rally*14))*(slow?.7:1),.075,'triangle',.13);this.tone(110,.035,'sine',.17);}
  bounce(){if(!this.sample('bounce',.3,.96))this.tone(720,.035,'triangle',.035);}
  item(){[523,659,784,1047].forEach((n,i)=>this.tone(n,.18,'sine',.1,i*.07));}
  end(){[523,659,784,1047,784,1047].forEach((n,i)=>this.tone(n,.25,'triangle',.07,i*.13));}
}
