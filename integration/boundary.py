"""Method + full-path security boundary. Unclassified routes are disabled."""
import re

SAFE_METADATA_ROUTES=(
    ('GET',r'/'), ('GET',r'/static/.+'),
    ('GET',r'/(openapi.json|docs|docs/oauth2-redirect|redoc)'),
    ('GET',r'/api/machines'), ('GET',r'/api/machine/[^/]+'),
    ('PATCH|DELETE',r'/api/machines/[^/]+'), ('POST',r'/api/machines/reorder'),
    ('GET|POST',r'/api/projects'), ('POST',r'/api/projects/reorder'),
    ('PATCH|DELETE',r'/api/projects/[^/]+'),
    ('GET',r'/api/testlibrary(?:/meta|/export)?'),
    ('GET|POST|DELETE',r'/api/links'),
)
CYCLE_ROUTES=(
    ('GET',r'/api/cycle/status'),
    ('GET',r'/api/projects/[^/]+/cycle/targets'),
    ('GET|POST',r'/api/projects/[^/]+/cycle/jobs'),
    ('GET',r'/api/projects/[^/]+/cycle/jobs/[^/]+'),
    ('POST',r'/api/projects/[^/]+/cycle/jobs/[^/]+/(confirm|stop)'),
    ('GET',r'/api/projects/[^/]+/cycle/jobs/[^/]+/(events|artifacts|files/.+)'),
)
MANUAL_CONTROL_ROUTES=(
    ('POST',r'/api/machine/[^/]+/(power|reboot)'),
    ('GET',r'/api/cycle/controls(?:/control-[a-f0-9]{32})?'),
    ('POST',r'/api/cycle/controls/control-[a-f0-9]{32}/reconcile'),
)
DISABLED_REMOTE_ROUTES=(
    ('.*',r'/api/(ai|kvm|terminal|ssh)(?:/.*)?'),
    ('.*',r'/api/machine/[^/]+/(aux|diagnose|detail|sensors|terminal|kvm)(?:/.*)?'),
    ('.*',r'/api/machines(?:/probe-bmc|/[^/]+/change-(os|bmc)-ip)'),
    ('.*',r'/ws/.*'),
)


def matches(routes,method,path):
    return any(re.fullmatch(verbs,method) and re.fullmatch(pattern,path) for verbs,pattern in routes)


def category(method,path):
    if matches(DISABLED_REMOTE_ROUTES,method,path): return 'DISABLED_REMOTE_ROUTES'
    for label,routes in (('SAFE_METADATA_ROUTES',SAFE_METADATA_ROUTES),('CYCLE_ROUTES',CYCLE_ROUTES),('MANUAL_CONTROL_ROUTES',MANUAL_CONTROL_ROUTES)):
        if matches(routes,method,path): return label
    return 'DISABLED_REMOTE_ROUTES'
