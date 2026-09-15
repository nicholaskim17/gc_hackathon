export class Sound {
  context:AudioContext|null=null; muted=false;private buffers:Partial<Record<'paddle'|'bounce'|'theme',AudioBuffer>>={};private loading:Promise<void>|null=null;private themeSource:AudioBufferSourceNode|null=null;private themeGain:GainNode|null=null;
  async unlock(){try{this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();void this.loadSamples();}catch{/* Silent play remains available. */}}
  private loadSamples(){if(this.loading||!this.context)return this.loading;const context=this.context,base=new URL(import.meta.env.BASE_URL,location.href);
    this.loading=Promise.all(([['paddle','audio/paddle-hit.mp3'],['bounce','audio/table-bounce.mp3'],['theme','audio/mii-channel.mp3']] as const).map(async([name,path])=>{const response=await fetch(new URL(path,base));if(!response.ok)throw new Error(`Could not load ${path}`);this.buffers[name]=await context.decodeAudioData(await response.arrayBuffer());})).then(()=>{this.startTheme();}).catch(()=>{/* Synthesized effects remain available if a sample cannot load. */});return this.loading;
  }
  private startTheme(){if(this.muted||!this.context||this.themeSource||!this.buffers.theme)return;const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers.theme;source.loop=true;gain.gain.value=.08;source.connect(gain);gain.connect(this.context.destination);source.start();this.themeSource=source;this.themeGain=gain;}
  setMuted(muted:boolean){this.muted=muted;if(this.themeGain&&this.context)this.themeGain.gain.setTargetAtTime(muted?0:.08,this.context.currentTime,.015);if(!muted)this.startTheme();}
  private sample(name:'paddle'|'bounce',volume:number,rate=1){if(this.muted||!this.context||!this.buffers[name])return false;const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=this.buffers[name]!;source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(this.context.destination);source.start();return true;}
  tone(freq:number,duration=.09,type:OscillatorType='sine',volume=.1,delay=0){
    if(this.muted||!this.context)return;const c=this.context,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,c.currentTime+delay);o.frequency.exponentialRampToValueAtTime(freq*.7,c.currentTime+delay+duration);
    g.gain.setValueAtTime(0,c.currentTime+delay);g.gain.linearRampToValueAtTime(volume,c.currentTime+delay+.006);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+duration);
    o.connect(g);g.connect(c.destination);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+duration);
  }
  private noise(duration=.08,volume=.05,frequency=1800,delay=0){if(this.muted||!this.context)return;const c=this.context,length=Math.max(1,Math.floor(c.sampleRate*duration)),buffer=c.createBuffer(1,length,c.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.7;gain.gain.setValueAtTime(volume,c.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+duration);source.buffer=buffer;source.connect(filter);filter.connect(gain);gain.connect(c.destination);source.start(c.currentTime+delay);}
  hit(rally:number,slow=false){const rate=(slow?.82:1)+Math.min(.18,rally*.006);this.sample('paddle',.48,rate);this.noise(.055,.075,2600);this.tone((520+Math.min(420,rally*18))*(slow?.7:1),.09,'triangle',.1);this.tone(82,.13,'sine',.19);if(rally>8)this.tone(1040+Math.min(700,rally*16),.07,'sine',.045,.025);}
  bounce(){this.sample('bounce',.32,.96);this.tone(760,.045,'triangle',.038);this.noise(.025,.018,1200);}
  item(power?:string){this.noise(.32,.09,power==='clone'?4800:3200);[392,523,659,784,1047,1319].forEach((n,i)=>this.tone(power==='giant'?n*.72:power==='clone'?n*1.22:n,.2,power==='clone'?'triangle':'sine',.085,i*.052));this.tone(power==='giant'?46:70,.28,'sine',.16);}
  miss(){this.noise(.18,.035,450);[260,210,150].forEach((n,i)=>this.tone(n,.15,'sawtooth',.035,i*.075));}
  net(){this.noise(.09,.055,900);this.tone(145,.12,'square',.025);}
  perfect(){this.noise(.22,.06,4200);[784,1047,1319,1568].forEach((n,i)=>this.tone(n,.22,'sine',.07,i*.045));}
  point(){this.noise(.4,.075,1800);[262,392,523,784].forEach((n,i)=>this.tone(n,.28,'triangle',.07,i*.065));this.tone(58,.3,'sine',.18);}
  end(){this.noise(.8,.1,2400);[523,659,784,1047,784,1047,1319].forEach((n,i)=>this.tone(n,.28,'triangle',.075,i*.11));}
}
