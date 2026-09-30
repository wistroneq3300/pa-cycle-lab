"""Create an explicitly synthetic demo inventory; never overwrite existing data."""
import json
import sys
import shutil
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from integration.settings import DATA

def bootstrap():
    library=DATA/'tests.json'
    if not library.exists():
        shutil.copyfile(Path(__file__).resolve().parents[1]/'app/data/tests.json',library)
    path = DATA / 'data.json'
    if path.exists():
        return
    machines = {}
    for i in range(4):
        name = f'neutrino-n{i}'
        machines[name] = dict(name=name, project='Neutrino Demo', level='system', mgx_type='server',
            order=i, tray='tray1', node=f'n{i}', cycle_profile='neutrino',
            os_ip=f'192.0.2.{10+i}', bmc_ip=f'198.51.100.{10+i}',
            os_hostname=f'os-n{i}' if i else '', bmc_hostname=f'bmc-n{i}' if i else '',
            os_user='root', bmc_user='root', os_port=22, bmc_port=22, ipmi_cipher=17,
            power_domain=f'node-{i}', aux_domain='tray1', aux_scope_confirmed=True,
            synthetic=True)
    payload = dict(machines=machines, projects={
        'Neutrino Demo':dict(name='Neutrino Demo',desc='SYNTHETIC · 離線示範資料',order=0,cycle_profile='neutrino'),
        'Other platform':dict(name='Other platform',desc='尚未支援的 profile 範例',order=1)}, links=[],seq=5)
    with path.open('x', encoding='utf-8') as stream:
        json.dump(payload, stream, ensure_ascii=False, indent=2)
    print('Created SYNTHETIC inventory:', path)

if __name__ == '__main__':
    bootstrap()
