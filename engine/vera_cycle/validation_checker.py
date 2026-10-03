"""Run the single reviewed project checker against collected files, locally.

No remote installation is necessary. This is not a Bash sandbox: executable
changes require a reviewed content digest. Numeric/profile-only edits are
normalized separately, so ordinary quantity changes need no extra approval.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from cycle_transport import Command
from validation_collectors import HARDWARE_INPUTS


def logic_hash(script):
    text=script.replace('\r\n','\n')
    # Only whole numeric assignments and the existing profile parameter contract
    # are omitted; no arbitrary shell expansion is accepted as a quantity edit.
    text=re.sub(r'^(?:CPU_MIN|DIMM_EXPECTED|NVMe_MIN|NIC_MIN|BF4_EXPECTED|PCIEFAB_MIN|USB_MIN|BMC_MIN)=\d+$','',text,flags=re.M)
    text=re.sub(r'^PROFILE_[A-Za-z0-9_]+_(?:ENABLED|MODE)=(?:0|1|exact|minimum)\n','',text,flags=re.M)
    text=re.sub(r'^MEMORY_MIN_RATIO=(?:0(?:\.\d+)?|1(?:\.0+)?)\n','',text,flags=re.M)
    return hashlib.sha256(text.encode()).hexdigest()


def reviewed(script):
    path=Path(__file__).with_name('validation_checkers.json')
    registry=json.loads(path.read_text(encoding='utf-8'))
    return logic_hash(script) in registry['reviewed_logic_hashes']


def run_checker(script,inputs,bash=None):
    if not reviewed(script): return Command(126,'Checker executable content has not been registered for snapshot evaluation','NOT_READY')
    executable=bash or os.environ.get('VALIDATION_BASH') or shutil.which('bash')
    if not executable: return Command(127,'Bash is required on the controller for the project checker','NOT_READY')
    with tempfile.TemporaryDirectory(prefix='validation-checker-') as folder:
        root=Path(folder); path=root/'checker.sh'; path.write_text(script,encoding='utf-8',newline='\n')
        for name in (*HARDWARE_INPUTS,'pci'):
            item=inputs.get(name,{})
            (root/(name+'.txt')).write_text(item.get('raw',''),encoding='utf-8',newline='\n')
            rc=item.get('code',125) if item.get('collection_status')=='SUCCESS' else 125
            (root/(name+'.rc')).write_text(str(rc)+'\n',encoding='ascii',newline='\n')
        env=dict(os.environ,VALIDATION_SNAPSHOT_DIR=root.as_posix(),LC_ALL='C')
        try:
            result=subprocess.run([executable,path.as_posix()],cwd=root,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=60)
            return Command(result.returncode,(result.stdout+result.stderr)[:2097152])
        except subprocess.TimeoutExpired: return Command(124,'Snapshot checker exceeded its local evaluation deadline','TIMED_OUT')
