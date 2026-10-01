"""Method + full-path security boundary. Unclassified routes are disabled."""
import re

SAFE_METADATA_ROUTES=(
    ('GET',r'/api/ai/gpu-alerts'),
    ('GET',r'/api/machine/[^/]+/telemetry'),
    ('GET',r'/api/rack/[^/]+/telemetry'),
    ('GET',r'/'), ('GET',r'/static/.+'),
    ('GET',r'/(openapi.json|docs|docs/oauth2-redirect|redoc)'),
    ('GET',r'/api/machines'),
    ('POST',r'/api/machines/[^/]+/(os|select-os)'),
    ('PATCH|DELETE',r'/api/machines/[^/]+/os/[0-9]+'),
    ('PATCH',r'/api/machines/[^/]+/(placement|rack-specification|cdu-installation|management-ip)'),
    ('GET',r'/api/projects/[^/]+/topology'),
    ('GET',r'/api/cycle/(inventory|runs|capabilities)'), ('GET',r'/api/machine/[^/]+'),
    ('PATCH|DELETE',r'/api/machines/[^/]+'), ('POST',r'/api/machines/reorder'),
    ('GET|POST',r'/api/projects'), ('POST',r'/api/projects/reorder'),
    ('PATCH|DELETE',r'/api/projects/[^/]+'),
    ('GET',r'/api/testlibrary(?:/meta|/export)?'),
    ('GET|POST|DELETE',r'/api/links'),
)
CYCLE_ROUTES=(
    ('POST',r'/api/cycle/runs'),
    ('GET',r'/api/cycle/status'), ('GET',r'/api/cycle/runs/[a-f0-9]{32}'),
    ('GET',r'/api/projects/[^/]+/cycle/targets'),
    ('GET|POST',r'/api/projects/[^/]+/cycle/jobs'),
    ('GET',r'/api/projects/[^/]+/cycle/jobs/[^/]+'),
    ('POST',r'/api/projects/[^/]+/cycle/jobs/[^/]+/(confirm|stop|reconcile)'),
    ('GET',r'/api/projects/[^/]+/cycle/jobs/[^/]+/(events(?:/download)?|reconciliation|artifacts|artifact/[a-f0-9]+|files/.+)'),
)
MANUAL_CONTROL_ROUTES=(
    ('GET',r'/api/cycle/sessions'),
    ('POST',r'/api/cycle/sessions/session-[a-f0-9]{32}/reconcile'),
    ('POST',r'/api/machine/[^/]+/(power|reboot)'),
    ('GET',r'/api/cycle/controls(?:/control-[a-f0-9]{32})?'),
    ('POST',r'/api/cycle/controls/control-[a-f0-9]{32}/reconcile'),
)
LEGACY_REMOTE_ROUTES=(
    ('.*',r'/api/(ai|kvm|terminal|ssh)(?:/.*)?'),
    ('.*',r'/api/machine/[^/]+/(aux|diagnose|detail|sensors)(?:/.*)?'),
    ('.*',r'/api/machine/[^/]+/(terminal|kvm)(?:/.*)?'),
    ('.*',r'/api/machines(?:/probe-bmc|/[^/]+/change-(os|bmc)-ip)'),
    ('.*',r'/ws/.*'),
)


def matches(routes,method,path):
    return any(re.fullmatch(verbs,method) and re.fullmatch(pattern,path) for verbs,pattern in routes)


def category(method,path):
    if method=='GET' and path=='/api/ai/gpu-alerts':return 'SAFE_METADATA_ROUTES'
    if matches(LEGACY_REMOTE_ROUTES,method,path): return 'LEGACY_REMOTE_ROUTES'
    for label,routes in (('SAFE_METADATA_ROUTES',SAFE_METADATA_ROUTES),('CYCLE_ROUTES',CYCLE_ROUTES),('MANUAL_CONTROL_ROUTES',MANUAL_CONTROL_ROUTES)):
        if matches(routes,method,path): return label
    return 'LEGACY_REMOTE_ROUTES'
