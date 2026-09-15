import {useEffect} from 'react';
/** The game runtime updates fast HUD values independently of React's render cycle. */
export function App(){useEffect(()=>{void import('./main');},[]);return <div id="app"/>;}
