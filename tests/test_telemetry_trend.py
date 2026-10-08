import pytest

import app.main as main
from app.main import app, _telemetry_trend_desc, machine_telemetry_analyze


@pytest.mark.parametrize(
    'values,expected',
    [
        ([], '沒有趨勢資料'),
        ([42], '資料不足'),
        ([10, 20], '上升'),
        ([10, 11, 12, 13], '持平'),
        ([40, 38, 20, 18], '下降'),
    ],
)
def test_telemetry_trend_requires_enough_samples(values,expected):
    assert _telemetry_trend_desc(values)==expected


def test_machine_telemetry_analysis_route_uses_endpoint_handler():
    route=next(route for route in app.routes if getattr(route,'path',None)=='/api/machine/{name}/telemetry/analyze')
    assert route.endpoint is machine_telemetry_analyze


def test_analysis_separates_observation_inference_and_evidence_limits(monkeypatch):
    monkeypatch.setitem(main.machines,'fixture-node',{'name':'fixture-node'})
    monkeypatch.setattr(main.telemetry_core,'init_db',lambda:None)
    monkeypatch.setattr(main,'machine_telemetry',lambda *args,**kwargs:{
        'os':{'os':[{'cpu_used':35,'load1':1,'load5':1,'mem_used_pct':40,'mem_used_gb':4,'mem_total_gb':10}],
              'disk':[]},'gpu':{'series':[]}})
    prompt={}
    def llm(system,user,**kwargs):
        prompt.update(system=system,user=user)
        return 'Metrics 持平，未觀測到異常趨勢。'
    monkeypatch.setattr(main,'_llm_chat',llm)
    result=machine_telemetry_analyze('fixture-node')
    assert result['ok'] is True
    assert result['analysis_result']['evidence_source']=='Prometheus / DCGM Metrics'
    assert '未讀取或新增 Xid' in result['analysis_result']['evidence_limit']
    assert '不得聲稱觀測到 Xid、SEL、PCIe、dmesg' in prompt['system']
