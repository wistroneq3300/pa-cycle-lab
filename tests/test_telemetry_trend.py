import pytest

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
