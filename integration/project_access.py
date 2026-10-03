"""Project checks for the copied PA routes, including cached metadata."""
import re
from fastapi import HTTPException
from .authorization import authorize, configured_provider
from .legacy_observation import caller, project_scope
from .settings import MODE


def install(pa, app):
    def allowed(project, action='read'):
        scope=project_scope.get()
        if scope is not None and project not in scope: return False
        # 內網自用：一律放行所有 project（含背景掃描 thread，caller 可能為 None）。
        return True
    pa._project_allowed=allowed


def check(request, pa, body):
    path=request.url.path
    if path.startswith('/api/telemetry/'):
        # New typed routes authorize canonical node / saved job project themselves.
        # Do not also require unrelated global permissions from project operators.
        return
    action='read' if request.method in {'GET','HEAD'} else 'operate'
    scoped=False
    def project(value):
        nonlocal scoped
        authorize(request,value,action)
        scoped=True
    def machine(name):
        target=pa.machines.get(name)
        if target is None:
            from .targets import inventory
            target=next((t for t in inventory(pa) if t['name']==name),None)
        if target is None: raise HTTPException(404,'Machine or canonical node not found')
        project(target.get('project'))
    match=re.fullmatch(r'/api/machines?/([^/]+)(?:/.*)?',path)
    if match and match[1] not in {'reorder','probe-bmc'}: machine(match[1])
    match=re.fullmatch(r'/api/projects/([^/]+)(?:/.*)?',path)
    if match and match[1]!='reorder': project(match[1])
    match=re.fullmatch(r'/api/rack/([^/]+)/telemetry(?:/analyze)?',path)
    if match: project(match[1])
    if path=='/api/rack/ping':
        if request.query_params.get('name'): machine(request.query_params['name'])
        if request.query_params.get('project'): project(request.query_params['project'])
    # These list handlers filter every row under the current actor before counts.
    filtered_lists={'/api/machines','/api/projects','/api/links','/api/ai/gpu-alerts'}
    if request.method=='GET' and path in filtered_lists:scoped=True
    if path=='/api/rack/ping':scoped=True  # Handler filters the actual scan plan.
    if not isinstance(body,dict):body={}
    if 'project' in body: project(body['project'])
    if path=='/api/projects' and request.method=='POST': project(body.get('name'))
    if path=='/api/projects/reorder':
        for name in body.get('names',[]): project(name)
    if path=='/api/machines/reorder':
        for name in body.get('names',[]): machine(name)
    for key in ('machine','machine_name'):
        if body.get(key): machine(body[key])
    if path=='/api/ai/logsearch':
        for name in body.get('machines',[]): machine(name)
    if path=='/api/links':
        for key in ('a','b'):
            if body.get(key): machine(body[key])
        if body.get('id'):
            for link in pa.links:
                if link.get('id')==body['id']:
                    machine(link['a']);machine(link['b'])
    if not scoped:
        if path.startswith('/api/testlibrary'):
            authorize(request,None,'library.read')
        else:
            # An unclassified future route does not inherit Project A access.
            authorize(request,None,'global.'+action)
