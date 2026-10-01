"""Web coordination around the unchanged Vera evaluator and report contract."""
import copy
import threading
import uuid
from cycle_engine import NodeSession
from cycle_transport import IdentityUnsafe
from .store import Conflict


class Domain:
    def __init__(self, key, sessions, store, job_id):
        self.key, self.sessions, self.store, self.job_id = key, sessions, store, job_id
        self.lock = threading.RLock()
        self.sel = {}
        self.barrier = threading.Barrier(len(sessions))
        self.result = None
        self.leader = sessions[0]

    def new_round(self):
        self.barrier = threading.Barrier(len(self.sessions))
        self.result = None


class CoordinatedSession(NodeSession):
    domain = None
    store = None
    job_id = None
    snapshot = None
    controller_collector = None
    identity_provider = None

    def identity(self, record, role, *args, **kwargs):
        if self.identity_provider is not None:
            if not self.identity_provider.verify_identity(self.snapshot,role,self.transport):
                raise IdentityUnsafe('Provider rejected immutable hardware identity/trust binding')
        return super().identity(record,role,*args,**kwargs)

    def sel_command(self, record, stem, action, **kwargs):
        d = self.controller_collector
        if not d:
            return super().sel_command(record, stem, action, **kwargs)
        key = (record['phase'], record.get('loop',0), stem, action)
        with d.lock:
            if key not in d.sel:
                before=len(record['issues'])
                result = super().sel_command(record, stem, action, **kwargs)
                d.sel[key] = (result, copy.deepcopy(record['commands'][stem]),copy.deepcopy(record['issues'][before:]))
                self.event(record, 'INFO', 'DOMAIN_SEL', 'Controller SEL evidence collected once', detail=d.key)
                return result
            result, command, issues = d.sel[key]
            record['commands'][stem] = copy.deepcopy(command)
            record['issues'].extend(copy.deepcopy(issues))
            record.setdefault('domain_evidence', []).append(dict(domain=d.key, reference=command.get('evidence')))
            return result

    def dispatch(self, record, label, role, cmd, sudo=False, timeout=30):
        d = self.domain
        shared = d is not None and len(d.sessions) > 1
        if shared:
            d.barrier.wait(timeout=self.options.boot_timeout)
        if not shared or self is d.leader:
            action_id = uuid.uuid4().hex
            affected = [s.machine_id for s in d.sessions] if d else [self.machine_id]
            self.store.intent(self.job_id, dict(action_id=action_id, run_id=self.job_id,
                domain=d.key if d else self.machine_id, loop=record['loop'], affected_targets=affected,
                before_boot={s.machine_id: s.expected_boot for s in d.sessions} if d else {self.machine_id:self.expected_boot},
                binding=self.snapshot.get('revision'), command=cmd, outcome='DISPATCH_INTENT'))
            # Recheck immediately before the transport call, including a stop
            # arriving while the durable intent was being written.
            original_command = self.command
            def guarded_command(*args, **kwargs):
                if self.store.get(self.job_id)['stop_requested']:
                    self.store.action_result(action_id, 'NOT_ISSUED')
                    raise Conflict('Stop requested before hardware dispatch')
                return original_command(*args, **kwargs)
            self.command = guarded_command
            try:
                result = super().dispatch(record, label, role, cmd, sudo, timeout)
            finally:
                self.command = original_command
            self.store.action_result(action_id, result)
            if shared:
                d.result = (result, copy.deepcopy(record['commands'][label]), copy.deepcopy(record['action'][-1]))
        if shared:
            d.barrier.wait(timeout=self.options.boot_timeout)
            if self is not d.leader:
                result, command, action = d.result
                record['commands'][label] = copy.deepcopy(command)
                record['action'].append(dict(action, shared_domain=d.key, action_leader=d.leader.machine_id))
                self.event(record, 'INFO', 'DOMAIN_ACTION', 'Shared domain action dispatched by leader; waiting for this node recovery', detail=d.key)
            return d.result[0]
        return result

    def one_loop(self, number):
        try:
            return super().one_loop(number)
        finally:
            if self.domain and len(self.domain.sessions) > 1 and self.domain.result is None:
                # A pre-dispatch identity/script fault must wake peers, never deadlock.
                self.domain.barrier.abort()
