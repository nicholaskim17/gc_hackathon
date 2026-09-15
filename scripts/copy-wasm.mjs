import {cp,mkdir,readdir,appendFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(new URL('../apps/client/package.json',import.meta.url));
const source=join(dirname(require.resolve('@mediapipe/tasks-vision')),'wasm');
await mkdir('apps/client/public/wasm',{recursive:true});
await cp(source,'apps/client/public/wasm',{recursive:true});

// The vendor UMD loader uses a top-level var. Module workers need an explicit
// global export; classic workers retain exactly the same factory.
for (const file of await readdir('apps/client/public/wasm')) {
 if(file.endsWith('.js')) await appendFile(join('apps/client/public/wasm',file),'\n;globalThis.ModuleFactory = ModuleFactory;\n');
}
