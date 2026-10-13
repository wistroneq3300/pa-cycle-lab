'use strict';
// Decode selected existing encoded frames only. No renderer, interpolation,
// resize, grading, blending or authored-time retiming is involved.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/screenshots/l10-cinematic/final-rc'),metadata=JSON.parse(fs.readFileSync(path.join(out,'evidence/video.json'),'utf8'));
const ffmpeg=process.env.FFMPEG_PATH||path.join(root,'artifacts/l10-cooling-v1/playwright/ffmpeg-1011/ffmpeg-win64.exe'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(metadata.pass,true);assert.equal(metadata.container.fps,25);assert.equal(sha(fs.readFileSync(path.join(out,'film.webm'))),metadata.sha256);
const dir=path.join(out,'evidence/film-frames');fs.mkdirSync(dir,{recursive:true});
const timestamps=[...Array.from({length:Math.floor(metadata.container.durationSeconds/2)},(_,i)=>i*2),18.4,19.2,20.4,20.8,21.2,21.6,22.4,23.2,metadata.container.durationSeconds-.08];
const indices=[...new Set(timestamps.map(t=>Math.max(0,Math.floor(t*25))))].sort((a,b)=>a-b),frames=[];
for(const index of indices){
 const name='encoded-'+String(index).padStart(5,'0')+'.png',file=path.join(dir,name);
 const args=['-hide_banner','-loglevel','error','-i',path.join(out,'film.webm'),'-vf','trim=start_frame='+index+':end_frame='+(index+1),'-vsync','0','-frames:v','1','-y',file];
 const result=cp.spawnSync(ffmpeg,args,{encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(result.status,0,result.stderr);
 const bytes=fs.readFileSync(file);assert.equal(bytes.readUInt32BE(16),3440);assert.equal(bytes.readUInt32BE(20),1440);
 frames.push({frameIndex:index,nominalContainerTimeSeconds:index/25,file:'evidence/film-frames/'+name,sha256:sha(bytes),dimensions:[3440,1440]});
}
const report={passed:true,source:'film.webm',sourceSHA256:metadata.sha256,fps:25,method:'FFmpeg PNG decode of exact zero-based encoded frame indices. Native3440×1440 pixels; no resize, grading, renderer reconstruction, interpolation or timewarp.',limits:['Container timestamps are not authored timeline timestamps. The uncut video includes setup before Replay; no guessed subtraction is applied.','Decoded stills complement the complete movie; they do not alone establish motion smoothness.'],frames};
fs.writeFileSync(path.join(out,'evidence/film-frames.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(dir,'index.html'),'<!doctype html><meta charset="utf-8"><title>Native encoded movie frames</title><style>body{background:#151819;color:#eee;font:16px system-ui;margin:20px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}img{width:100%}figure{margin:0}figcaption{padding:8px}@media(max-width:900px){main{grid-template-columns:1fr}}</style><h1>Decoded native movie frames</h1><p>Exact encoded frame index / container time. These are not authored timeline timestamps. No image edits or resampling.</p><main>'+frames.map(f=>'<figure><a href="'+path.basename(f.file)+'"><img loading="lazy" src="'+path.basename(f.file)+'"></a><figcaption>Frame'+f.frameIndex+' · container'+f.nominalContainerTimeSeconds.toFixed(2)+'s</figcaption></figure>').join('')+'</main>');
console.log(JSON.stringify({passed:true,frames:frames.length,sourceSHA256:metadata.sha256},null,2));
