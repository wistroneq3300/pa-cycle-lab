"""Run inherited PA pytest fixtures with local files and loopback-only networking.

These unit/mock broker tests do not enable any disabled PA Cycle Lab route.
Install pytest in the project venv first. No production broker is started.
"""
import os
from pathlib import Path
import socket
import sys
import uuid
from unittest.mock import patch
import pytest

ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'data'/('legacy-tests-'+uuid.uuid4().hex)
folder.mkdir(parents=True)
sys.path.insert(0,str(ROOT/'app'))
from spx_kvm_broker.config import BrokerConfig

original_init=BrokerConfig.__init__
def local_config(self,*args,**kwargs):
    original_init(self,*args,**kwargs)
    for name in ('secret_file','identity_file','registry_db','audit_log'):
        candidate=Path(getattr(self,name))
        if not candidate.resolve().is_relative_to(ROOT):setattr(self,name,folder/candidate.name)

original_connect=socket.socket.connect
def local_connect(self,address):
    if isinstance(address,tuple) and address[0] not in {'127.0.0.1','::1','localhost'}:
        raise AssertionError('Inherited test attempted non-loopback networking')
    return original_connect(self,address)

if __name__=='__main__':
    with patch.object(BrokerConfig,'__init__',local_config),patch.object(socket.socket,'connect',local_connect):
        raise SystemExit(pytest.main([str(ROOT/'app/tests'),'-q','--basetemp',str(folder/'tmp'),'-o',f'cache_dir={folder / "cache"}']))
