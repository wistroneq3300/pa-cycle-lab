'use strict';
// Verify captured evidence is for the current runtime, not an earlier candidate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/p1-final');
const baseline='b3664ea97d52f1e6d756de00cfb5a8c84821c0cc';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(out,p),'utf8'));
const runtime=['app/static/js/core-scene.js','app/static/js/l10-hardware.js','app/static/js/validation-overview.js','app/static/js/l10-timeline.js','app/static/js/l10-gltf.js','app/static/js/l10-asset-runtime.js','app/static/js/rack-equipment-scene.js','app/static/models/l10-prototype/bare-compute-boards.glb','app/static/models/l10-cooling-v1/cooling-assembly.glb'];
const reports=['after/playback.json','ssd/after/ssd-playback.json','integration/dashboard.json','integration/opt-in.json','integration/review.json'];
const manifest={baseline,scope:'Final current-disk runtime and recorded network/served bytes. Git baseline read with git show, without checkout.',runtime:[],reports:[],artifacts:[]};
for(const file of runtime){
  const bytes=fs.readFileSync(path.join(root,file)),old=cp.execFileSync('git',['show',baseline+':'+file],{cwd:root,maxBuffer:96*1024*1024});
  const current=sha(bytes);manifest.runtime.push({file,sha256:current,baselineSHA256:sha(old),unchanged:bytes.equals(old)});
  for(const name of reports){const report=read(name),sources=report.resources;
    const record=Array.isArray(sources)?[...sources,...(report.gpu?.assets||[])].find(r=>r.path==='/'+file.slice(4)):sources[file];
    if(name.startsWith('ssd/')&&file.endsWith('validation-overview.js'))continue;
    if(name==='integration/review.json'&&file.endsWith('validation-overview.js'))continue;
    assert.ok(record,`${name} must capture ${file}`);assert.equal(record.sha256,current,`${name} stale ${file}`);
  }
}
for(const name of reports){const report=read(name);if('pass'in report)assert.equal(report.pass,true);if(report.errors)assert.deepEqual(report.errors,[]);manifest.reports.push({file:name,sha256:sha(fs.readFileSync(path.join(out,name)))});}
assert.equal(read('integration/summary.json').pass,true);assert.equal(read('preservation.json').passed,true);
const film=read('after/playback.json');assert.equal(film.entry,'/#/dashboard');assert.equal(film.film.final.playback.duration,39700);assert.equal(film.film.flowSummary.minimumResolution,1);
assert.equal(sha(fs.readFileSync(path.join(out,'after/film.webm'))),film.film.sha256);
assert.equal(sha(fs.readFileSync(path.join(out,'ssd/after/ssd-orbit.webm'))),read('ssd/after/ssd-playback.json').videoSHA256);
for(const name of fs.readdirSync(out,{recursive:true}).sort()){
  const file=path.join(out,name);if(!fs.statSync(file).isFile()||name==='delivery-manifest.json')continue;
  const bytes=fs.readFileSync(file);manifest.artifacts.push({file:name.replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)});
}
manifest.pass=true;manifest.note='The review HTML retains pre-existing mixed LF/CRLF in the tested working file. Git normalizes it on commit; script URLs/content are identical. JS, GLB and compiled Shader SHA are captured separately; no version mixing is inferred from HTML line endings.';
fs.writeFileSync(path.join(out,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({pass:true,runtimeFiles:manifest.runtime.length,verifiedEvidenceReports:manifest.reports.length,artifacts:manifest.artifacts.length,film:film.film.flowSummary},null,2));
