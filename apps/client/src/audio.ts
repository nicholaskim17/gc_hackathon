export class Sound {
  context:AudioContext|null=null; muted=false;
  async unlock(){try{this.context??=new AudioContext();if(this.context.state==='suspended')await this.context.resume();}catch{/* Silent play remains available. */}}
  tone(freq:number,duration=.09,type:OscillatorType='sine',volume=.1,delay=0){
    if(this.muted||!this.context)return;const c=this.context,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,c.currentTime+delay);o.frequency.exponentialRampToValueAtTime(freq*.7,c.currentTime+delay+duration);
    g.gain.setValueAtTime(0,c.currentTime+delay);g.gain.linearRampToValueAtTime(volume,c.currentTime+delay+.006);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+duration);
    o.connect(g);g.connect(c.destination);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+duration);
  }
  hit(rally:number,slow=false){this.tone((440+Math.min(300,rally*14))*(slow?.7:1),.075,'triangle',.13);this.tone(110,.035,'sine',.17);}
  item(){[523,659,784,1047].forEach((n,i)=>this.tone(n,.18,'sine',.1,i*.07));}
  end(){[523,659,784,1047,784,1047].forEach((n,i)=>this.tone(n,.25,'triangle',.07,i*.13));}
}
