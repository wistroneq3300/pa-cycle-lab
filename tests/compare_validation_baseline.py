"""Run identical isolated suites on the pinned baseline and working tree.

Creates an archive copy, never switches or resets a checkout. Artifacts include
JUnit IDs so targeted reruns are not added to full-suite totals.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid
import zipfile
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/shared-validation/comparison';OUT.mkdir(parents=True,exist_ok=True)
base=Path(tempfile.mkdtemp(prefix='pa-validation-baseline-'))
archive=OUT/'baseline.zip'
subprocess.run(['git','archive','--format=zip','-o',str(archive),'d6fa3afcd35477c3a55ec7de8851d72b0097c520'],cwd=ROOT,check=True)
with zipfile.ZipFile(archive) as z: z.extractall(base)
results={}
for label,root in [('baseline',base),('current',ROOT)]:
    results[label]={}
    for suite,folder in [('integration','tests'),('vera','engine/vera_cycle/dev/tests'),('pa','app/tests')]:
        env=dict(os.environ,PYTHONUTF8='1',CYCLE_MODE='synthetic',CYCLE_INSTANCE='data/paired-'+uuid.uuid4().hex[:8],
                 PYTHONPATH=os.pathsep.join(map(str,[root,root/'engine/vera_cycle',root/'app'])))
        env.pop('PA_DATA_DIR',None)
        if suite=='pa': env['PA_DATA_DIR']=str(root/env['CYCLE_INSTANCE'])
        xml=OUT/(label+'-'+suite+'.xml')
        with (OUT/(label+'-'+suite+'.txt')).open('w',encoding='utf-8') as log:
            try:
                result=subprocess.run([sys.executable,'-m','pytest',folder,'-q','--tb=short','--junitxml='+str(xml)],cwd=root,env=env,stdout=log,stderr=log,timeout=1800)
                results[label][suite]={'exit_code':result.returncode}
            except subprocess.TimeoutExpired: results[label][suite]={'timeout':True}
        if xml.exists():
            cases={}
            for case in ET.parse(xml).iter('testcase'):
                status='failed' if case.find('failure') is not None else 'error' if case.find('error') is not None else 'skipped' if case.find('skipped') is not None else 'passed'
                cases[case.get('classname')+'.'+case.get('name')]=status
            results[label][suite]['cases']=cases
        (OUT/'results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps({label:{name:{s:list(data.get('cases',{}).values()).count(s) for s in ('passed','failed','error','skipped')} for name,data in suites.items()} for label,suites in results.items()},indent=2))
