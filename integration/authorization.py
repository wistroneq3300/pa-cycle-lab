"""Caller identity is supplied by a trusted server-side provider, never a header username."""
import importlib
import os
from fastapi import HTTPException
from .settings import MODE


def configured_provider():
    module = os.environ.get('CYCLE_PROVIDER')
    return importlib.import_module(module).provider if module else None


def authenticate(request):
    provider = getattr(request.app.state, 'cycle_provider', None) or configured_provider()
    if provider is None:
        # 內網自用：無 provider 時以本機 operator 身分放行（live 亦然）。
        return 'local-operator'
    actor = provider.authenticate(request)
    if not actor:
        raise HTTPException(401, 'Authenticated caller required')
    return actor


def authorize(request, project, action):
    actor=authenticate(request)
    provider=getattr(request.app.state,'cycle_provider',None) or configured_provider()
    if provider is not None and not provider.authorize(actor, project, action):
        raise HTTPException(403, 'Project/run access denied')
    return actor
