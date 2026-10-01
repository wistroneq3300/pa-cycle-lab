"""內網自用 provider：放行所有認證/授權/enrollment。

由 CYCLE_PROVIDER=local_provider 啟用。這台主機是內網自用管理機，
不需要外部身分驗證。
"""
from types import SimpleNamespace


def _authenticate(request):
    return 'local-operator'


def _authorize(actor, project, action):
    return True


def _approve_enrollment(actor, plan):
    return True


def _approve_legacy_observation(actor, rows, operation):
    return True


def _service_principal(purpose):
    return 'local-service-principal'


def _credentials(credential_ref, credential_version=None):
    return {}


def _verify_identity(machine, role, transport):
    return True


def _verify_action_scope(*args, **kwargs):
    return True


def _approve_dispatch(job):
    return True


def _verify_reconciliation(job, actions):
    return True


def _verify_session_reconciliation(record):
    return True


provider = SimpleNamespace(
    authenticate=_authenticate,
    authorize=_authorize,
    approve_enrollment=_approve_enrollment,
    approve_legacy_observation=_approve_legacy_observation,
    service_principal=_service_principal,
    credentials=_credentials,
    verify_identity=_verify_identity,
    verify_action_scope=_verify_action_scope,
    approve_dispatch=_approve_dispatch,
    verify_reconciliation=_verify_reconciliation,
    verify_session_reconciliation=_verify_session_reconciliation,
)
