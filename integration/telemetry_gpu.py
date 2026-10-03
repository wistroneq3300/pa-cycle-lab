"""GPU extension of the identity-verified provision path; no driver installation."""
import csv
import io
import json
import re
import shlex
from .telemetry_monitoring import register_target, unregister_target, address


def setup_instructions(config,target):
    """Display-only instructions; this function never dispatches a command."""
    image=config.dcgm_image or '<選擇與目前 GPU／Driver 相容的固定版本映像>'
    return dict(exporter_url='http://'+address(target['os_ip'],config.dcgm_port)+'/metrics',
                prometheus_url=config.prometheus_url,file_sd=config.file_sd,image=config.dcgm_image,
                detection='nvidia-smi\ndocker info --format '+shlex.quote('{{json .Runtimes}}'),
                installation=shlex.join(['sudo','docker','run','-d','--name','pa-dcgm-exporter','--restart','unless-stopped','--gpus','all','--cap-add','SYS_ADMIN','-p',str(config.dcgm_port)+':9400',image,'--no-hostname']),
                check_on_manager='curl --fail --max-time 10 '+shlex.quote('http://'+address(target['os_ip'],config.dcgm_port)+'/metrics'),
                documentation='https://docs.nvidia.com/datacenter/dcgm/latest/installation/install-dcgm-exporter.html')

GPU_DETECT = '''# PA_GPU_CAPABILITY
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=index,uuid,name,driver_version --format=csv,noheader
  printf 'SMI_RC=%s\\n' "$?"
else echo SMI_RC=127; fi
if command -v lspci >/dev/null 2>&1; then
  echo PCI_BEGIN; lspci -Dn; printf 'PCI_RC=%s\\n' "$?"
else echo PCI_RC=127; fi
'''


def parse_gpu(text):
    gpus=[]
    for row in csv.reader(io.StringIO(text.split('SMI_RC=')[0])):
        if len(row)==4 and row[0].strip().isdigit() and row[1].strip().startswith('GPU-'):
            gpus.append(dict(index=row[0].strip(),uuid=row[1].strip(),model=row[2].strip(),driver=row[3].strip()))
    if gpus: return 'SUPPORTED',gpus
    if 'PCI_RC=0' in text and not re.search(r'\b03[0-9a-f]{2}:\s+10de:',text,re.I): return 'NOT_APPLICABLE',[]
    return 'UNAVAILABLE',[]


def detect_command(port):
    return '''# PA_DCGM_DETECT
for u in nvidia-dcgm-exporter.service dcgm-exporter.service; do
 if test "$(systemctl show "$u" --property=LoadState --value 2>/dev/null)" = loaded; then
  printf 'UNIT=%s\\n' "$u";printf 'ACTIVE=';systemctl is-active "$u" || true;break
 fi
done
printf 'VERSION='; dcgm-exporter --version 2>/dev/null || true
printf 'LISTENER='; ss -H -ltnp 'sport = :PORT'
printf 'RUNTIMES='; docker info --format '{{json .Runtimes}}' 2>/dev/null || true
printf 'CONTAINER='; docker inspect --format '{{.State.Status}}|{{.Config.Image}}' pa-dcgm-exporter 2>/dev/null || true
'''.replace(':PORT',':'+str(int(port)))


def provision(service,target,job_id,command):
    def event(step,text,level='STEP'): service.store.step(job_id,step,text,level)
    capability,gpus=parse_gpu(command('GPU_DETECT','Detecting NVIDIA GPU capability.',GPU_DETECT))
    result=dict(state='DEGRADED',gpus=gpus,version='',detail='')
    if capability=='NOT_APPLICABLE':
        unregister_target(service.config,target['node_id'],'gpu')
        event('GPU_DETECT','No NVIDIA GPU detected. GPU telemetry is not applicable.','INFO')
        return dict(result,state='NOT_APPLICABLE',detail='No NVIDIA GPU detected')
    if capability!='SUPPORTED':
        return dict(result,detail='GPU capability could not be confirmed. Check the existing driver and NVIDIA tools.')
    event('GPU_DETECT',f'{len(gpus)} NVIDIA GPU(s) detected. Driver {gpus[0]["driver"]}.','PASS')
    text=command('GPU_EXPORTER','Inspecting DCGM Exporter, service, and listener.',detect_command(service.config.dcgm_port))
    facts=dict(line.split('=',1) for line in text.splitlines() if '=' in line)
    result['version']=facts.get('VERSION') or facts.get('CONTAINER','').partition('|')[2]
    state,detail=service.monitor.gpu_exporter(target)
    if state=='OTHER' or (state!='READY' and facts.get('LISTENER')):
        return dict(result,detail='GPU port is occupied or cannot be verified as DCGM. The existing process was preserved.')
    if state=='READY':
        event('GPU_EXPORTER','Existing DCGM Exporter retained. No upgrade or reinstall.','PASS')
    elif facts.get('UNIT'):
        unit=facts['UNIT']
        if unit not in ('nvidia-dcgm-exporter.service','dcgm-exporter.service'): return dict(result,detail='Unrecognized DCGM service')
        if facts.get('ACTIVE')=='active': return dict(result,detail='DCGM service is active but metrics are unreachable')
        command('GPU_SERVICE','Starting the existing DCGM service.','systemctl start '+unit,60)
    elif facts.get('CONTAINER'):
        status,_,image=facts['CONTAINER'].partition('|')
        if status not in ('exited','created'): return dict(result,detail='Existing DCGM container is not healthy; no container was replaced')
        command('GPU_SERVICE','Starting the existing PA DCGM container.','docker start pa-dcgm-exporter',60)
    else:
        image=service.config.dcgm_image
        if not image: return dict(result,detail='DCGM installation image is not configured. Set a supported pinned PA_DCGM_EXPORTER_IMAGE.')
        try: runtimes=json.loads(facts.get('RUNTIMES','{}'))
        except ValueError: runtimes={}
        if 'nvidia' not in runtimes: return dict(result,detail='Automatic DCGM setup requires an existing Docker NVIDIA runtime. No runtime or driver was installed.')
        cmd=shlex.join(['docker','run','-d','--name','pa-dcgm-exporter','--restart','unless-stopped','--gpus','all','--cap-add','SYS_ADMIN',
                       '-p',str(service.config.dcgm_port)+':9400',image,'--no-hostname'])
        command('GPU_INSTALL','Starting the configured DCGM Exporter image.',cmd,300)
        result['version']=image
    for _ in range(10):
        service.binding(target);state,detail=service.monitor.gpu_exporter(target)
        if state=='READY': break
        if service.stop_event.wait(1): return dict(result,detail='GPU verification interrupted')
    if state!='READY': return dict(result,detail=detail)
    event('GPU_METRICS','DCGM /metrics verified. Publishing the GPU target.','PASS')
    register_target(service.config,target,'gpu')
    return dict(result,state='VERIFYING',detail='GPU target published; awaiting Prometheus')
