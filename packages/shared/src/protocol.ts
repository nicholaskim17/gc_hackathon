import type {Game,GameEvent,RacketInput} from './engine';
export interface Snapshot{code:string;phase:'lobby'|'countdown'|'playing'|'paused'|'results';countdown:number;reason:string;players:{side:number;connected:boolean;ready:boolean;replay:boolean}[];game:Game;serverTime:number}
export type InputPacket=RacketInput&{ready:boolean;sequence?:number};
export interface FormSubmission{hitId:string;score:number}
export type ReliableEvents=GameEvent[];
