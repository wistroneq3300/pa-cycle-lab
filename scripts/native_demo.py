"""Explicit synthetic inventory: one chassis with four nodes by default. No network."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from integration.settings import DATA, ROOT, MODE
sys.path.insert(0,str(ROOT/'app'))
from node_identity import migrate


def fixture(chassis=1, nodes=4, shared=False):
    machines={}
    for c in range(chassis):
        name=f'chassis-{c+1:02d}'
        slots=[]
        for n in range(nodes):
            i=c*nodes+n+1
            slots.append(dict(slot=n+1,label=f'N{n+1}',ip=f'192.0.{i//254+2}.{i%254+1}',
                user=f'user-{n+1}',port=2222+n,**{'pass':f'SYNTHETIC-OS-{i}'},
                bmc_ip=f'198.18.{c if shared else i//254}.{1 if shared else i%254+1}',
                bmc_user=f'bmc-{n+1}',bmc_pass=f'SYNTHETIC-BMC-{i}',bmc_ssh_port=2200+n,
                os_hostname=f'os-{i}',bmc_hostname=f'bmc-{c if shared else i}',ipmi_cipher=17,
                controller_id=f'controller-{c if shared else i}',power_domain=f'power-{c if shared else i}',
                aux_domain=f'aux-{c if shared else i}',aux_scope_confirmed=True,
                credential_ref=f'demo-{i}',credential_version='1',mapping_status='confirmed',
                capabilities={'shared_power':'synthetic-confirmed'} if shared else {'independent_power':True}))
        machines[name]=dict(id=c+1,name=name,project='Neutrino Demo',level='rack',rack_u=0,rack_size=1,
            mgx_type='server',tray=f'tray{c+1}',cycle_profile='neutrino',synthetic=True,active_os=1,os=slots,
            os_ip=slots[0]['ip'],os_user=slots[0]['user'],os_pass=slots[0]['pass'],os_port=slots[0]['port'],
            bmc_ip=slots[0]['bmc_ip'],bmc_user=slots[0]['bmc_user'],bmc_pass=slots[0]['bmc_pass'])
    return migrate(dict(machines=machines,projects={'Neutrino Demo':dict(name='Neutrino Demo',desc='SYNTHETIC · No hardware',order=0,cycle_profile='neutrino')},links=[],seq=chassis+1))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--chassis',type=int,default=1);parser.add_argument('--nodes',type=int,default=4);parser.add_argument('--shared',action='store_true');args=parser.parse_args()
    if MODE!='synthetic': parser.error('Synthetic only')
    if not 1<=args.chassis*args.nodes<=4096: parser.error('1..4096 synthetic targets')
    path=DATA/'data.json'
    with path.open('x',encoding='utf-8') as f: json.dump(fixture(args.chassis,args.nodes,args.shared),f,ensure_ascii=False,indent=2)
    from scripts.bootstrap import bootstrap
    bootstrap()
    print('Created synthetic chassis/node inventory:',path)
