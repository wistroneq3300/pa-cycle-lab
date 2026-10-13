'use strict';
// Only output paths change; original assertions and runtime timing run intact.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
let root=__dirname;while(!fs.existsSync(path.join(root,'app/qa/l10-bareboard-regression.cjs'))){const parent=path.dirname(root);if(parent===root)throw new Error('Repository root not found');root=parent;}
const choices={bareboard:['l10-bareboard-regression.cjs','../../artifacts/l10-bareboard/evidence'],cinematic:['l10-cinematic.cjs','../../artifacts/l10-cinematic/evidence'],rack:['hero-rack-isolation.cjs','../../artifacts/hero-cinematic-v3']};
const choice=choices[process.argv[2]];if(!choice)throw new Error('Choose bareboard, cinematic or rack');
const file=path.join(root,'app/qa',choice[0]),source=fs.readFileSync(file,'utf8');
if(source.split(choice[1]).length!==2)throw new Error('Expected exactly one existing output path');
const target=new Module(file,module);target.filename=file;target.paths=Module._nodeModulePaths(path.dirname(file));
target._compile(source.replace(choice[1],'../../artifacts/l10-cooling-v2/evidence/browser'),file);
