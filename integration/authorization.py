"""Caller identity is supplied by a trusted server-side provider, never a header username."""
import importlib
import os
from fastapi import HTTPException
from .settings import MODE


def configured_provider():
    module = os.environ.get('CYCLE_PROVIDER')
    return importlib.import_module(module).provider if module else None


def authorize(request, project, action):
    provider = getattr(request.app.state, 'cycle_provider', None) or configured_provider()
    if provider is None:
        if MODE != 'synthetic':
            raise HTTPException(503, 'Live Cycle requires a verified identity/authorization provider')
        return 'synthetic-local-operator'
    actor = provider.authenticate(request)
    if not actor:
        raise HTTPException(401, 'Authenticated caller required')
    if not provider.authorize(actor, project, action):
        raise HTTPException(403, 'Project/run access denied')
    return actor
