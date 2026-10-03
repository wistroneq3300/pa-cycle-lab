"""Observation-only resource budgets over the existing credential transport.

No dispatcher or fallback action is used. Cycle keeps its original defaults.
"""
import os
import shlex
import shutil
import subprocess
import threading
import time
from cycle_transport import Transport, Command


class ObservationTransport(Transport):
    output_limit=2097152
    # Match PA's existing Lab policy; inventory binding establishes ownership.
    # This opt-in does not change the Cycle transport's campaign behavior.
    lab_noninteractive=True

    def bounded(self,argv,timeout,env=None):
        start=time.monotonic(); chunks=[]; size=0; overflow=False
        try:
            process=subprocess.Popen(argv,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        except OSError as exc: return Command(127,self.redact(str(exc)),'NOT_ISSUED')
        def read():
            nonlocal size,overflow
            while True:
                data=process.stdout.read(65536)
                if not data: break
                chunks.append(data);size+=len(data)
                if size>self.output_limit:
                    overflow=True;process.kill();break
        reader=threading.Thread(target=read,daemon=True);reader.start()
        try: code=process.wait(timeout)
        except subprocess.TimeoutExpired: process.kill();process.wait();code=124
        reader.join(2);process.stdout.close()
        return Command(125 if overflow else code,self.redact(b''.join(chunks).decode(errors='replace')),
                       'OUTPUT_LIMIT' if overflow else 'RETURNED',time.monotonic()-start)

    def oob(self,target,command,timeout=30):
        env=dict(os.environ,IPMI_PASSWORD=self.credentials.get('bmc',''))
        return self.bounded(['ipmitool','-I','lanplus','-p',str(self.ipmi_port),'-C',str(self.cipher),'-H',target.bmc_ip,
                             '-U',self.users.get('bmc','root'),'-E',*shlex.split(command)],timeout,env)

    def _redfish(self,args,timeout):
        if not shutil.which('curl'): return Command(127,'curl is unavailable','NOT_ISSUED')
        # Fail HTTP errors as well as network errors; missing service is distinct
        # from an authentication/network failure in the collector envelope.
        return self.bounded(['curl','-sk','--fail-with-body','-m',str(int(timeout)),*args],timeout+5)
