import asyncio
from unittest.mock import AsyncMock, Mock
import kvm_bridge as kvm


def test_probe_logs_out_owned_session_and_caches_only_kind(monkeypatch):
    monkeypatch.setattr(kvm,'_BASE_CACHE',{})
    monkeypatch.setattr(kvm,'_load_machine',lambda name:{'bmc_ip':'192.0.2.1','bmc_user':'fixture','bmc_pass':'fixture'})
    monkeypatch.setattr(kvm,'_detect_bmc',lambda *args:('spx','token',{'QSESSIONID':'fixture'}))
    logout=Mock(return_value=True)
    monkeypatch.setattr(kvm,'_logout_bmc',logout)
    assert kvm._detect_basecode_one('node') == 'spx'
    assert kvm._detect_basecode_one('node') == 'spx'
    logout.assert_called_once_with('192.0.2.1','spx','token',{'QSESSIONID':'fixture'})


def test_failed_websocket_connect_logs_out(monkeypatch):
    monkeypatch.setattr(kvm,'_detect_bmc',lambda *args:('spx','token',{'QSESSIONID':'fixture'}))
    monkeypatch.setattr(kvm.websockets,'connect',AsyncMock(side_effect=RuntimeError('fixture failure')))
    logout=Mock(return_value=True)
    monkeypatch.setattr(kvm,'_logout_bmc',logout)
    socket,_=asyncio.run(kvm._connect_kvm('192.0.2.1','fixture','fixture'))
    assert socket is None
    logout.assert_called_once()


def test_connection_close_logs_out_exactly_once(monkeypatch):
    socket=Mock(close=AsyncMock())
    logout=Mock(return_value=True)
    monkeypatch.setattr(kvm,'_logout_bmc',logout)
    async def run():
        owned=kvm.OwnedKvmConnection(socket,'192.0.2.1','spx','token',{})
        await asyncio.gather(owned.close(),owned.close())
    asyncio.run(run())
    logout.assert_called_once()
    socket.close.assert_awaited_once()


def test_redfish_logout_uses_session_location_without_following_other_host(monkeypatch):
    import requests
    delete=Mock(return_value=Mock(status_code=204))
    monkeypatch.setattr(requests,'delete',delete)
    cookies=kvm.SessionCookies()
    cookies.session_location='/redfish/v1/SessionService/Sessions/fixture'
    assert kvm._logout_bmc('192.0.2.1','openbmc','fixture-token',cookies)
    assert delete.call_args.args[0]=='https://192.0.2.1/redfish/v1/SessionService/Sessions/fixture'
    assert delete.call_args.kwargs['allow_redirects'] is False
    cookies.session_location='https://other.example/redfish/v1/SessionService/Sessions/fixture'
    assert not kvm._logout_bmc('192.0.2.1','openbmc','fixture-token',cookies)
    assert delete.call_count==1


def test_unverified_onetree_adapter_reports_unsupported(monkeypatch):
    import requests
    post=Mock()
    monkeypatch.setattr(requests,'post',post)
    assert not kvm._logout_bmc('192.0.2.1','ami','fixture',{})
    post.assert_not_called()
