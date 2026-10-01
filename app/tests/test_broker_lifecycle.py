"""Broker lifecycle using temporary SQLite, fake clients and actual async launch."""
import asyncio
import json
import threading
import time
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from spx_kvm_broker.broker import Broker
from spx_kvm_broker.config import BrokerConfig, BMCTarget
from spx_kvm_broker.registry import SessionRegistry
from spx_kvm_broker.spx_client import MaxSessionsError


@pytest.fixture
def broker(tmp_path, monkeypatch):
    cfg = BrokerConfig(registry_db=tmp_path/'sessions.db', audit_log=tmp_path/'audit.log',
                       login_cooldown_seconds=0, login_rate_limit_max=100)
    cfg.targets = {name: BMCTarget(name, name+'.example.test', '192.0.2.1', 'fixture') for name in ['a','b']}
    registry = SessionRegistry(cfg.registry_db)
    service = Broker(cfg, Mock(credential=lambda name: {'username':'fixture','password':'fixture'}), registry)
    client = Mock()
    client.login.return_value = {'QSESSIONID':'fixture-cookie'}
    client.logout.return_value = True
    monkeypatch.setattr('spx_kvm_broker.broker.SpxClient', Mock(return_value=client))
    service.test_client = client
    yield service
    if service.audit._fh:
        service.audit._fh.close()
    registry.close()


def test_expired_not_returned_or_reused(broker):
    broker.reg.put_session('old','a','a.example.test','user','browser',{'QSESSIONID':'expired'},-1)
    assert broker.reg.active_session_for('a','user','browser') is None
    assert broker.reg.any_active_session_for_server('a') is None
    assert broker._reuse_or_login(broker.cfg.targets['a'],'user','browser')['QSESSIONID'] == 'fixture-cookie'
    assert broker.reg.get_session('old').state == 'stale'
    broker.test_client.logout.assert_called_once()


def test_cap_includes_same_user_different_browser_and_other_users(broker):
    broker._reuse_or_login(broker.cfg.targets['a'],'user','browser1')
    for user, browser in [('user','browser2'),('other','browser3')]:
        with pytest.raises(MaxSessionsError):
            broker._reuse_or_login(broker.cfg.targets['a'],user,browser)
    assert broker.reg.active_session_count('a') == 1
    broker.test_client.login.assert_called_once()
    broker._reuse_or_login(broker.cfg.targets['a'],'user','browser1')
    broker.test_client.login.assert_called_once()


def test_configured_cap_and_concurrent_launch_are_serialized(broker):
    from concurrent.futures import ThreadPoolExecutor
    broker.cfg.targets['a'].max_broker_sessions = 2
    def login(index):
        try:
            broker._reuse_or_login(broker.cfg.targets['a'],'user',str(index))
            return True
        except MaxSessionsError:
            return False
    with ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(login,range(5)))
    assert sum(results) == 2
    assert broker.reg.active_session_count('a') == 2


def test_idle_sweeper_logs_out_and_preserves_recent_sessions(broker):
    broker.reg.put_session('old','a','a.example.test','user','browser',{'QSESSIONID':'old'},100)
    broker.reg.put_session('fresh','b','b.example.test','user','browser',{'QSESSIONID':'new'},100)
    with broker.reg._lock:
        broker.reg._conn.execute('UPDATE broker_sessions SET last_seen_at=? WHERE broker_session_id=?',(time.time()-1000,'old'))
        broker.reg._conn.commit()
    broker.sweep_idle_and_expired()
    assert broker.reg.get_session('old').state == 'stale'
    assert broker.reg.get_session('fresh').state == 'active'


def test_slow_login_leaves_event_loop_and_other_target_responsive(broker, monkeypatch):
    started, release = threading.Event(), threading.Event()
    original = broker._reuse_or_login
    def slow(target, user, browser):
        if target.server_id == 'a':
            started.set()
            assert release.wait(3)
        return original(target,user,browser)
    monkeypatch.setattr(broker,'_reuse_or_login',slow)
    def request(target):
        launch = broker.mint_launch('user','browser',target,None)['launch_id']
        async def body():
            return {'launch_id': launch}
        return SimpleNamespace(headers={'content-type':'application/json','host':target+'.example.test'},json=body)
    async def run():
        first = asyncio.create_task(broker.handle_launch(request('a')))
        try:
            for _ in range(100):
                if started.is_set():
                    break
                await asyncio.sleep(.01)
            assert started.is_set()
            other = await asyncio.wait_for(broker.handle_launch(request('b')),1)
            assert other.status_code == 302
        finally:
            release.set()
            assert (await first).status_code == 302
    asyncio.run(run())
