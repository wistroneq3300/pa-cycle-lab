"""Offline observation transport. No sockets, remote shells or device actions."""
import json
from cycle_transport import Command
from validation_collectors import OPERATIONS


def outputs():
    pci='0000:01:00.0 Ethernet controller [0200]: NVIDIA BlueField-4 [15b3:a2dc]\n\tCapabilities: [40] Express (v2) Endpoint, MSI 00\n\tLnkCap: Speed 32GT/s, Width x16\n\tLnkSta: Speed 32GT/s, Width x16\n\t[SN] Serial number: BOARD-1\n'
    pci+='\n'.join(f'0000:{i:02x}:00.0 PCI bridge [0604]: NVIDIA bridge [10de:1234]' for i in range(2,22))+'\n'
    pci+='0000:22:00.0 USB controller [0c03]: USB [1234:1234]\n0000:23:00.0 VGA controller [0300]: AST1150 [1a03:2000]\n'
    return {'pci':pci,'CPU':'Status: Populated, Enabled\nThread Count: 1\n'*2,'CPU-online':'0,0,Y\n1,1,Y\n',
            'DIMM':'Size: 64 GB\n'*16,'OS-memory':'MemTotal: 1000000000 kB\n',
            'NVMe':'/dev/nvme0n1 disk\n/dev/nvme1n1 disk\n',
            'MST':'\n'.join(f'Vera 0000:{i:02x}:00.0' for i in range(22)),
            'BIOS-firmware':'BIOS Information\nVersion: fixture-1\n','firmware':'BIOS Version: fixture-1\n',
            'system':'Linux fixture 6.8\n','drivers':'mlx5_core 1 0\n','sensor':'CPU Temp | 35 | degrees C | ok | na\n',
            'sel':'','sel_info':'Entries: 0\nLast Del Time: Not Available\n','power':'Chassis Power is on\n',
            'host_power':'Host: Running\nChassis Power: On\n','bmc_identity':'fixture-controller',
            'bmc_firmware':'Firmware Revision: fixture-1\n','kernel_snapshot':'','tools':'lspci version 3.9\ndmidecode 3.5\nnvme version 2.6\nipmitool version 1.8.19\n6.8-fixture\n'}


class FixtureTransport:
    def __init__(self,target,scenario=None,calls=None):
        self.target=target; self.scenario=scenario or {}; self.calls=calls if calls is not None else []
        self.raw=outputs(); self.raw.update(self.scenario.get('raw',{}))

    def ssh(self,target,role,command,timeout=60,sudo=False):
        self.calls.append((self.target['node_id'],role,command))
        if command==OPERATIONS['identity'].command:
            if 'identity' in self.scenario.get('failed',[]): return Command(124,'Fixture timeout')
            boot=self.scenario.get('boot_id','00000000-0000-0000-0000-000000000001')
            return Command(0,'HOSTNAME='+self.scenario.get('hostname',self.target.get('os_hostname','fixture'))+'\nBOOT_ID='+boot+'\n')
        if role=='bmc' and command=='hostname':
            return Command(0,self.scenario.get('bmc_hostname','fixture-bmc'))
        if command.startswith('bash -o pipefail -c '):
            rows=self.scenario.get('journal',[])
            if '--after-cursor=' in command:
                matching=[i for i,r in enumerate(rows) if r['__CURSOR'] in command]
                if matching: rows=rows[max(matching)+1:]
            return Command(0,'\n'.join(json.dumps(r) for r in rows[:512]))
        for name,op in OPERATIONS.items():
            if (op.role,op.command)==(role,command):
                if name in self.scenario.get('failed',[]): return Command(124,'Fixture collection timeout')
                return Command(0,self.raw.get(name,''))
        raise AssertionError('Unrecognized observation command: '+command)

    def oob(self,target,command,timeout=30): return self.ssh(target,'oob',command,timeout)
    def redfish_login(self,target): return 'fixture-session'
    def redfish_get(self,target,path,token,timeout=30):
        self.calls.append((self.target['node_id'],'redfish',path))
        if 'redfish' in self.scenario.get('failed',[]): return Command(124,'Fixture timeout')
        if path=='/redfish/v1/Systems': payload={'Members':[{'@odata.id':'/redfish/v1/Systems/node'}]}
        elif path=='/redfish/v1/Managers': payload={'Members':[{'@odata.id':'/redfish/v1/Managers/bmc'}]} if self.scenario.get('bmc_hostname') else {'Members':[]}
        elif path=='/redfish/v1/Managers/bmc': payload={'HostName':self.scenario['bmc_hostname']}
        elif path.endswith('/LogServices'): payload={'Members':[{'@odata.id':path+'/EventLog'}]}
        elif path.endswith('/Entries'): payload={'Members':self.scenario.get('redfish',[])}
        else: payload={}
        return Command(0,json.dumps(payload))
