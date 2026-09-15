import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Game, POWER, TABLE_Y, type Vec3 } from './engine';
const material=(color:THREE.ColorRepresentation,roughness=.55,metalness=.05)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export class Renderer {
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(43,1,.05,100);gl:THREE.WebGLRenderer;
  rackets:THREE.Group[]=[];ballMeshes:THREE.Mesh[]=[];trails:THREE.Mesh[][]=[];ballShadows:THREE.Mesh[]=[];boxMeshes:THREE.Group[]=[];particles:THREE.InstancedMesh;
  disposed=false;shields:THREE.Mesh[]=[];powerLabels:THREE.Sprite[]=[];
  ring:THREE.Mesh;dust:THREE.Points;labels:THREE.Sprite[]=[];hitRings:THREE.Mesh[]=[];temp=new THREE.Object3D();targetPosition=new THREE.Vector3();look=new THREE.Vector3();particleColor=new THREE.Color();width=0;height=0;viewMode=0;frame=0;pixelRatio=Math.min(window.devicePixelRatio||1,1.25);reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  crowdBodies!:THREE.InstancedMesh;crowdHeads!:THREE.InstancedMesh;crowdBase:{x:number;y:number;z:number;r:number}[]=[];crowdPhase:number[]=[];showLights:THREE.SpotLight[]=[];impactLight:THREE.PointLight;
  constructor(public canvas:HTMLCanvasElement){
    this.gl=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
    this.gl.setPixelRatio(this.pixelRatio);this.gl.shadowMap.enabled=false;
    this.gl.toneMapping=THREE.ACESFilmicToneMapping;this.gl.toneMappingExposure=1.05;this.scene.background=new THREE.Color('#05090f');this.scene.fog=new THREE.FogExp2('#05090f',.045);
    this.scene.add(new THREE.HemisphereLight('#b7d9ff','#29354a',1.7));
    const key=new THREE.SpotLight('#e1efff',75,25,Math.PI/5,.55,1.2);key.position.set(1,7,2);key.target.position.set(0,0,0);this.scene.add(key,key.target);
    const fill=new THREE.PointLight('#50a2ff',18,12,1.5);fill.position.set(-3,3,-2);this.scene.add(fill);
    const warm=new THREE.PointLight('#ff9271',15,11,1.5);warm.position.set(3,2.5,3);this.scene.add(warm);
    const back=new THREE.DirectionalLight('#e4f1ff',1.3);back.position.set(0,3,-5);this.scene.add(back);
    this.impactLight=new THREE.PointLight('#ffffff',0,9,1.5);this.impactLight.position.set(0,1.5,0);this.scene.add(this.impactLight);
    for(const [color,x,z] of [['#66d9ff',-4,-3],['#ff765f',4,-2],['#d69cff',0,4]] as const){const spot=new THREE.SpotLight(color,28,24,.16,.55,1.2);spot.position.set(x,7,z);spot.target.position.set(0,1,0);this.showLights.push(spot);this.scene.add(spot,spot.target);}
    this.buildArena();
    for(let i=0;i<2;i++){const r=this.makeRacket(i===0?'#ed694e':'#57b9e8',i+1);this.rackets.push(r);this.scene.add(r);
      const shield=new THREE.Mesh(new THREE.SphereGeometry(.62,32,20),new THREE.MeshPhysicalMaterial({color:'#7ddcff',emissive:'#39a9ea',emissiveIntensity:.4,transparent:true,opacity:.19,roughness:.12,metalness:.5,side:THREE.DoubleSide,depthWrite:false}));shield.scale.z=.25;this.shields.push(shield);this.scene.add(shield);
      const label=this.label(i===0?'PLAYER 01':'PLAYER 02',i===0?'#ffbda6':'#9ddffa',22);label.scale.set(1.08,.19,1);this.labels.push(label);this.scene.add(label);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.2,.23,40),new THREE.MeshBasicMaterial({color:i===0?'#ffb490':'#a7efff',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));this.hitRings.push(ring);this.scene.add(ring);
    }
    const ballGeometry=new THREE.SphereGeometry(.065,16,10);
    for(let i=0;i<3;i++){
      const ball=new THREE.Mesh(ballGeometry,new THREE.MeshStandardMaterial({color:'#fff9eb',emissive:'#ffdaa0',emissiveIntensity:.28,roughness:.35}));ball.castShadow=true;this.ballMeshes.push(ball);this.scene.add(ball);
      const trail:THREE.Mesh[]=[];for(let n=0;n<12;n++){const m=new THREE.Mesh(ballGeometry,new THREE.MeshBasicMaterial({color:'#b7e5ff',transparent:true,opacity:.22*(1-n/12),depthWrite:false}));trail.push(m);this.scene.add(m);}this.trails.push(trail);
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.42,.42),new THREE.MeshBasicMaterial({map:this.shadowTexture(),transparent:true,depthWrite:false,opacity:.5}));shadow.rotation.x=-Math.PI/2;this.ballShadows.push(shadow);this.scene.add(shadow);
    }
    for(let i=0;i<3;i++){const box=this.makeBox();this.boxMeshes.push(box);this.scene.add(box);}
    this.particles=new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false}),520);this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particles.frustumCulled=false;this.scene.add(this.particles);
    const dustGeo=new THREE.BufferGeometry(),positions=new Float32Array(330);for(let i=0;i<positions.length;i+=3){positions[i]=(Math.random()-.5)*18;positions[i+1]=Math.random()*6;positions[i+2]=(Math.random()-.5)*18;}dustGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#94c5e5',size:.012,transparent:true,opacity:.38,depthWrite:false}));this.scene.add(this.dust);
    this.ring=new THREE.Mesh(new THREE.RingGeometry(4.7,4.715,120),new THREE.MeshBasicMaterial({color:'#325976',transparent:true,opacity:.5,side:THREE.DoubleSide}));this.ring.rotation.x=-Math.PI/2;this.ring.position.y=.011;this.scene.add(this.ring);
  }
  box(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,r=.025){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,r),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;this.scene.add(mesh);return mesh;}
  glow(color:string,intensity=2){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.3});}
  texture(draw:(ctx:CanvasRenderingContext2D)=>void,w=256,h=256){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;draw(canvas.getContext('2d')!);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;}
  shadowTexture(){return this.texture(c=>{const gradient=c.createRadialGradient(128,128,3,128,128,125);gradient.addColorStop(0,'rgba(0,0,0,.9)');gradient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gradient;c.fillRect(0,0,256,256);});}
  label(text:string,color='#ffffff',size=35){const texture=this.texture(c=>{c.font=`800 ${size}px Nunito, sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(text,256,64);},512,128);const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.scale.set(1,.25,1);return sprite;}
  buildArena(){
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),material('#080e18',.6,.15));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);
    const grid=new THREE.GridHelper(30,30,'#182a3b','#101c2a');grid.position.y=.003;(grid.material as THREE.Material).transparent=true;(grid.material as THREE.Material).opacity=.45;this.scene.add(grid);
    const steel=material('#18252f',.3,.8),rubber=material('#101a24',.75),tableMat=material('#154354',.69,.12);
    // Fine original procedural surface grain, with physical white court markings.
    const grain=this.texture(c=>{c.fillStyle='#a6a6a6';c.fillRect(0,0,256,256);for(let i=0;i<12000;i++){const v=125+Math.random()*50;c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect(Math.random()*256,Math.random()*256,1,1);}});grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(4,7);tableMat.roughnessMap=grain;
    this.box(3.42,.17,5.46,steel,0,TABLE_Y-.12,0,.06);this.box(3.3,.09,5.3,tableMat,0,TABLE_Y-.045,0,.045);
    const white=material('#d9eaf0',.65,.1);for(const x of [-1.59,1.59])this.box(.025,.003,5.16,white,x,TABLE_Y+.002,0,.001);
    for(const z of [-2.59,2.59])this.box(3.2,.003,.025,white,0,TABLE_Y+.002,z,.001);this.box(.012,.003,5.18,white,0,TABLE_Y+.003,0,.001);
    for(const x of [-1.28,1.28])for(const z of [-1.95,1.95]){this.box(.1,.79,.1,steel,x,.4,z,.012);this.box(.23,.05,.23,rubber,x,.035,z,.02);}
    for(const z of [-1.95,1.95])this.box(2.6,.055,.06,steel,0,.25,z,.01);
    this.box(3.22,.025,.025,this.glow('#ffa778',1.5),0,TABLE_Y-.14,2.735,.006);this.box(3.22,.025,.025,this.glow('#75cff7',1.5),0,TABLE_Y-.14,-2.735,.006);
    const frontBrand=this.label('R A L L Y !', '#c1d1db',31);frontBrand.position.set(0,.805,2.741);frontBrand.scale.set(.75,.16,1);this.scene.add(frontBrand);
    // Fine mesh net, top tape and solid metal posts, all with spatial depth.
    const netTexture=this.texture(c=>{c.clearRect(0,0,256,256);c.strokeStyle='#b4d7ed';c.lineWidth=1.3;for(let i=0;i<=256;i+=16){c.beginPath();c.moveTo(i,0);c.lineTo(i,256);c.moveTo(0,i);c.lineTo(256,i);c.stroke();}});netTexture.wrapS=netTexture.wrapT=THREE.RepeatWrapping;netTexture.repeat.set(6,1);
    const net=new THREE.Mesh(new THREE.PlaneGeometry(3.48,.22),new THREE.MeshStandardMaterial({map:netTexture,transparent:true,opacity:.63,side:THREE.DoubleSide,roughness:.8,depthWrite:false}));net.position.set(0,TABLE_Y+.11,0);this.scene.add(net);
    this.box(3.55,.022,.024,white,0,TABLE_Y+.23,0,.008);
    for(const x of [-1.77,1.77]){this.box(.045,.35,.045,steel,x,TABLE_Y+.09,0,.01);this.box(.14,.03,.22,rubber,x,TABLE_Y-.07,0,.01);}
    for(const x of [-4.3,4.3]){this.box(.025,.014,14,this.glow('#2b678b',.75),x,.016,0,.002);this.box(.08,2.3,.08,steel,x,1.15,-4,.012);this.box(.025,1.5,.025,this.glow('#85c7e7',1.2),x,1.55,-3.95,.005);}
    // Floating studio light rectangles set off the black environment.
    for(const z of [-3.8,3.8])this.box(5,.025,.04,this.glow('#d3e9ff',2.2),0,5.8,z,.005);
    for(const x of [-2.5,2.5])this.box(.04,.025,7.6,this.glow('#bfd9f6',1.8),x,5.8,0,.005);
    const sign=this.label('R A L L Y   C L U B','#7194af',30);sign.position.set(0,2.9,-7);sign.scale.set(3,.75,1);this.scene.add(sign);
    // Tiered arena seating wraps the court. The crowd is instanced so hundreds of
    // spectators can react to the rally without turning the scene into a draw-call storm.
    const concrete=material('#101923',.92,.08),seat=material('#1a2b3a',.75,.15);
    for(let row=0;row<6;row++){this.box(9,.3,.72,row%2?seat:concrete,0,.18+row*.31,-4.75-row*.48,.02);}
    for(const sideX of [-1,1])for(let row=0;row<5;row++){this.box(.72,.3,8,row%2?seat:concrete,sideX*(3.75+row*.46),.18+row*.31,-.15,.02);}
    const noise=this.label('M A K E   S O M E   N O I S E','#ffcf70',25);noise.position.set(0,4.15,-7.45);noise.scale.set(4.2,.72,1);this.scene.add(noise);
    for(const [text,color,x,z,ry] of [['RALLY!','#ff8066',-3.4,-4.22,0],['GO! GO! GO!','#6edcff',3.35,-4.22,0],['FEEL THE HIT','#d9a2ff',-3.28,0,Math.PI/2],['ONE MORE!','#ffe178',3.28,0,-Math.PI/2]] as const){const board=this.label(text,color,27);board.position.set(x,1.35,z);board.scale.set(1.5,.34,1);board.rotation.y=ry;this.scene.add(board);}
    this.buildCrowd();
    const under=new THREE.PointLight('#4e9dbc',2.3,4,2);under.position.set(0,.5,0);this.scene.add(under);
  }
  buildCrowd(){
    for(let row=0;row<6;row++)for(let col=0;col<24;col++)this.crowdBase.push({x:-4.25+col*.37,y:.55+row*.31,z:-4.72-row*.48,r:0});
    for(const side of [-1,1])for(let row=0;row<5;row++)for(let col=0;col<17;col++)this.crowdBase.push({x:side*(3.72+row*.46),y:.55+row*.31,z:-3.75+col*.46,r:side>0?-Math.PI/2:Math.PI/2});
    const colors=['#ff765f','#62d7ff','#ffd66d','#bd91ff','#6ce0ad','#f3f6ff'];
    this.crowdBodies=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,.36,.15),new THREE.MeshStandardMaterial({roughness:.82,metalness:.02}),this.crowdBase.length);
    this.crowdHeads=new THREE.InstancedMesh(new THREE.SphereGeometry(.105,7,5),new THREE.MeshStandardMaterial({roughness:.9}),this.crowdBase.length);
    this.crowdBodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.crowdHeads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.crowdBodies.frustumCulled=false;this.crowdHeads.frustumCulled=false;
    this.crowdBase.forEach((p,i)=>{this.crowdPhase.push(Math.random()*Math.PI*2);this.crowdBodies.setColorAt(i,this.particleColor.set(colors[i%colors.length]));this.crowdHeads.setColorAt(i,this.particleColor.set(['#f0c7a6','#9b6547','#dfaa7e','#704532'][i%4]));this.temp.position.set(p.x,p.y,p.z);this.temp.rotation.set(0,p.r,0);this.temp.updateMatrix();this.crowdBodies.setMatrixAt(i,this.temp.matrix);this.temp.position.y+=.28;this.temp.updateMatrix();this.crowdHeads.setMatrixAt(i,this.temp.matrix);});
    this.scene.add(this.crowdBodies,this.crowdHeads);
  }
  makeRacket(color:string,number:number){
    const group=new THREE.Group();const grain=this.texture(c=>{c.fillStyle=color;c.fillRect(0,0,256,256);c.fillStyle='#ffffff10';for(let y=0;y<256;y+=5)for(let x=0;x<256;x+=5){c.beginPath();c.arc(x,y,1,0,Math.PI*2);c.fill();}});
    const bladeWood=material('#ceac7e',.54),handleWood=material('#c5a173',.56),edge=material('#e9e1cd',.52);
    const faceMat=new THREE.MeshStandardMaterial({color:'#ffffff',map:grain,roughness:.82});
    const gripMat=material('#283442',.8),bandMat=material('#64717b',.7);
    // A real blade is ~15cm across and the table here is 3.3 units for 152cm, so life size
    // is about .18 radius. .28 keeps it readable at speed without becoming a shield.
    const R=.28;
    const disc=(radius:number,depth:number,mat:THREE.Material,z:number)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,depth,48),mat);mesh.rotation.x=Math.PI/2;mesh.scale.z=1.1;mesh.position.z=z;mesh.castShadow=true;group.add(mesh);return mesh;};
    const core=disc(R,.058,bladeWood,0),rim=disc(R*1.02,.02,edge,.02);
    const front=disc(R*.97,.022,faceMat,.036),back=disc(R*.97,.022,faceMat,-.036);
    // Handle and blade now read in proportion, so it looks gripped rather than mounted.
    const handle=new THREE.Mesh(new RoundedBoxGeometry(.112,.38,.09,3,.04),handleWood);handle.position.set(.012,-.41,0);handle.rotation.z=-.09;handle.castShadow=true;group.add(handle);
    const grip=new THREE.Mesh(new RoundedBoxGeometry(.118,.24,.096,3,.03),gripMat);grip.position.set(.021,-.48,0);grip.rotation.z=-.09;group.add(grip);
    for(let i=0;i<5;i++){const band=new THREE.Mesh(new THREE.BoxGeometry(.124,.007,.1),bandMat);band.position.set(.018,-.39-i*.042,0);band.rotation.z=-.09;group.add(band);}
    const logo=this.texture(c=>{c.fillStyle='#fff8ea';c.font='900 92px Nunito, sans-serif';c.textAlign='center';c.fillText('R',128,151);c.font='700 19px Nunito, sans-serif';c.fillText(`RALLY / 0${number}`,128,190);});
    const decalMat=new THREE.MeshBasicMaterial({map:logo,transparent:true,depthWrite:false});
    const decal=new THREE.Mesh(new THREE.PlaneGeometry(R*1.12,R*1.12),decalMat);decal.position.z=.05;group.add(decal);
    // Your own racket sits between your eye and the table. Stacking four see-through discs
    // just makes a smudge, so ghosting swaps the blade for a bright outline in your colour:
    // you still know exactly where your racket is, and the ball stays visible through it.
    const outline=new THREE.Mesh(new THREE.RingGeometry(R*.95,R*1.07,56),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,side:THREE.DoubleSide,depthWrite:false}));
    outline.scale.y=1.1;outline.visible=false;group.add(outline);
    const solids=[core,rim,back],dimmed=[{m:faceMat,dim:.22},{m:handleWood,dim:.82},{m:gripMat,dim:.82},{m:bandMat,dim:.82},{m:decalMat,dim:.12}]
      .map(e=>({...e,transparent:e.m.transparent,opacity:e.m.opacity,depthWrite:e.m.depthWrite}));
    let ghosted:boolean|null=null;
    group.userData.setGhost=(on:boolean)=>{
      if(on===ghosted)return;ghosted=on;
      for(const mesh of solids)mesh.visible=!on;
      front.position.z=on?0:.036;outline.visible=on;
      for(const e of dimmed){e.m.transparent=on||e.transparent;e.m.opacity=on?e.opacity*e.dim:e.opacity;e.m.depthWrite=on?false:e.depthWrite;e.m.needsUpdate=true;}
    };
    return group;
  }
  makeBox(){
    const group=new THREE.Group();
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.018,64),new THREE.MeshStandardMaterial({color:'#52c8ff',emissive:'#39a9ea',emissiveIntensity:.65,transparent:true,opacity:.3,roughness:.3}));group.add(disc);
    const target=new THREE.Mesh(new THREE.TorusGeometry(.37,.018,8,64),this.glow('#8ddfff',2));target.rotation.x=-Math.PI/2;group.add(target);
    const inner=new THREE.Mesh(new THREE.RingGeometry(.23,.235,48),new THREE.MeshBasicMaterial({color:'#b6f1ff',side:THREE.DoubleSide,transparent:true,opacity:.7}));inner.rotation.x=-Math.PI/2;inner.position.y=.014;group.add(inner);
    const label=this.label('POWER UP','#c4efff',31);label.position.y=.34;label.scale.set(.85,.21,1);group.add(label);this.powerLabels.push(label);
    group.userData.power='';return group;
  }
  project(p:Vec3){const v=new THREE.Vector3(p.x,p.y,p.z).project(this.camera);return {x:(v.x*.5+.5)*100,y:(-v.y*.5+.5)*100,visible:v.z<1&&v.z>-1};}
  draw(g:Game,t:number,demo=false){
    const width=this.canvas.clientWidth,height=this.canvas.clientHeight;if(!width||!height)return;
    if(width!==this.width||height!==this.height){this.width=width;this.height=height;this.gl.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
    const targetPosition=this.targetPosition,look=this.look.set(0,1.15,-.25);
    if(demo){targetPosition.set(5.6+Math.sin(t*.1)*.5,4.15,7.7);look.set(0,.95,0);}
    else if(this.viewMode===2){targetPosition.set(6.1,4.5,6.8);look.set(0,1,0);}
    else if(this.viewMode===1){targetPosition.set(g.rackets[1].x*.1,2.65,-6.3);look.set(0,1.1,.15);}
    else targetPosition.set(g.rackets[0].x*.1,2.65,6.3);
    if(!this.frame++)this.camera.position.copy(targetPosition);else this.camera.position.lerp(targetPosition,.08);
    if(g.shake&&!this.reducedMotion){this.camera.position.x+=Math.sin(t*115)*g.shake;this.camera.position.y+=Math.cos(t*91)*g.shake*.45;}
    this.camera.lookAt(look);
    if(g.shake&&!this.reducedMotion)this.camera.rotation.z+=Math.sin(t*78)*g.shake*.12;
    this.impactLight.intensity=g.shake*650+g.reveal*7;this.impactLight.color.set(g.reveal?'#ffd270':'#ffffff');
    this.showLights.forEach((light,i)=>{light.target.position.set(Math.sin(t*(.32+i*.07)+i*2)*2.8,1+Math.sin(t*.7+i)*.3,Math.cos(t*(.27+i*.05)+i)*2.5);light.intensity=22+Math.sin(t*1.8+i)*6+g.reveal*5;});
    const excitement=Math.min(1,g.rally/10+g.reveal*.55+g.shake*8);
    this.crowdBase.forEach((p,i)=>{const phase=this.crowdPhase[i],idle=Math.sin(t*2.2+phase)*.018,jump=this.reducedMotion?0:Math.max(0,Math.sin(t*(5.5+excitement*4)+phase))*excitement*.18;this.temp.position.set(p.x,p.y+idle+jump,p.z);this.temp.rotation.set(0,p.r,Math.sin(t*3+phase)*(.025+excitement*.07));this.temp.scale.set(1,1+excitement*.12,1);this.temp.updateMatrix();this.crowdBodies.setMatrixAt(i,this.temp.matrix);this.temp.position.y+=.29+excitement*.025;this.temp.scale.setScalar(1);this.temp.updateMatrix();this.crowdHeads.setMatrixAt(i,this.temp.matrix);});this.crowdBodies.instanceMatrix.needsUpdate=true;this.crowdHeads.instanceMatrix.needsUpdate=true;
    const own=demo||this.viewMode===2?-1:this.viewMode===1?1:0;
    this.rackets.forEach((r,i)=>{const p=g.rackets[i];r.position.set(p.x,p.y,p.z);r.rotation.set(-.08+(i===0?-1:1)*(p.swing*.28+p.impact*.16),p.tilt*.6,p.tilt*.6-(i===0?.13:-.13));r.scale.setScalar(g.racketScaleFor(i));r.scale.z*=1-p.impact*.12;
      (r.userData.setGhost as (on:boolean)=>void)(i===own);
      const shield=this.shields[i];shield.visible=!!g.playerEffects[i].shield;shield.position.copy(r.position);shield.scale.set(g.racketScaleFor(i),g.racketScaleFor(i),.25);
      r.traverse(child=>{if(child instanceof THREE.Mesh&&child.material instanceof THREE.MeshStandardMaterial){child.material.emissive.set(g.playerEffects[i].smash?'#ff5c13':'#000000');child.material.emissiveIntensity=g.playerEffects[i].smash?.45+Math.sin(t*5)*.15:0;}});
      const label=this.labels[i];label.position.set(p.x,p.y+.63*g.racketScaleFor(i),p.z);label.visible=demo||i!==(this.viewMode===1?1:0);
      const ring=this.hitRings[i];ring.position.copy(r.position);ring.scale.setScalar(1+(1-p.impact)*5.5);(ring.material as THREE.MeshBasicMaterial).opacity=p.impact*.9;ring.visible=p.impact>0;ring.quaternion.copy(this.camera.quaternion);
    });
    this.ballMeshes.forEach((mesh,i)=>{const b=g.balls[i];mesh.visible=!!b;this.ballShadows[i].visible=!!b;if(!b){this.trails[i].forEach(m=>m.visible=false);return;}
      mesh.position.set(b.x,b.y,b.z);mesh.scale.setScalar(g.radius/.065);mesh.rotation.x=t*3;mesh.rotation.z=t*2;
      const mat=mesh.material as THREE.MeshStandardMaterial;mat.color.set(b.smash?'#ffb348':'#fff9eb');mat.emissive.set(b.smash?'#ff6a19':'#ffdda1');mat.emissiveIntensity=b.smash?1.3:.3;
      const shadow=this.ballShadows[i];shadow.position.set(b.x,TABLE_Y+.008,b.z);shadow.visible=Math.abs(b.x)<1.65&&Math.abs(b.z)<2.65;shadow.scale.setScalar(1+Math.max(0,b.y-TABLE_Y)*.5);(shadow.material as THREE.MeshBasicMaterial).opacity=.6/(1+Math.max(0,b.y-TABLE_Y));
      this.trails[i].forEach((m,j)=>{const p=b.trail[j];m.visible=!!p&&!this.reducedMotion;if(p){m.position.set(p.x,p.y,p.z);m.scale.setScalar((1-j/12)*g.radius/.065);(m.material as THREE.MeshBasicMaterial).color.set(b.smash?'#ff7838':'#bbddff');}});
    });
    this.boxMeshes.forEach((mesh,i)=>{const b=g.boxes[i];mesh.visible=!!b;if(b){mesh.position.set(b.x,TABLE_Y+.022,b.z);mesh.scale.setScalar(1+Math.sin(t*2+b.phase)*.04);if(mesh.userData.power!==b.power){const old=this.powerLabels[i];(old.material as THREE.SpriteMaterial).map?.dispose();old.material.dispose();mesh.remove(old);const label=this.label(POWER[b.power].name.toUpperCase(),POWER[b.power].color,31);label.scale.set(.85,.21,1);label.position.y=.3;mesh.add(label);this.powerLabels[i]=label;mesh.userData.power=b.power;}}});
    this.particles.count=Math.min(520,g.particles.length);g.particles.slice(-520).forEach((p,i)=>{this.temp.position.set(p.x,p.y,p.z);this.temp.rotation.set(t*p.spin+i,p.spin*t*.7,i+p.spin*t);const stretch=1+Math.min(4,Math.hypot(p.vx,p.vy,p.vz)*.35);this.temp.scale.set(p.size,p.size*stretch,p.size);this.temp.scale.multiplyScalar(Math.min(1,p.life*4));this.temp.updateMatrix();this.particles.setMatrixAt(i,this.temp.matrix);this.particles.setColorAt(i,this.particleColor.set(p.color));});this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
    this.dust.rotation.y=t*.012;this.dust.rotation.x=Math.sin(t*.08)*.025;(this.dust.material as THREE.PointsMaterial).opacity=.32+Math.sin(t*.9)*.09+g.reveal*.08;this.gl.render(this.scene,this.camera);
  }
  dispose(){this.disposed=true;this.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)m.geometry.dispose();if(m.material){const mats=Array.isArray(m.material)?m.material:[m.material];for(const mat of mats){for(const value of Object.values(mat))if(value instanceof THREE.Texture)value.dispose();mat.dispose();}}});this.gl.dispose();this.gl.forceContextLoss();}
}
