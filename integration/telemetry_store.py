"""Durable optional Telemetry jobs. No Cycle state or inventory is stored here."""
from contextlib import contextmanager
import json
import sqlite3
import time
import uuid
from .events import redact, environment_secrets

ACTIVE = ('QUEUED', 'PROVISIONING')


class ProvisionStore:
    def __init__(self, path, secrets=lambda: ()):
        self.path = path
        self.secrets = secrets
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.tx() as db:
            db.executescript('''
              CREATE TABLE IF NOT EXISTS telemetry_jobs(
                job_id TEXT PRIMARY KEY,node_id TEXT NOT NULL,chassis_id TEXT NOT NULL,
                project TEXT NOT NULL,binding TEXT NOT NULL,idempotency_key TEXT NOT NULL,
                state TEXT NOT NULL,current_step TEXT NOT NULL DEFAULT 'QUEUED',
                created_at REAL NOT NULL,started_at REAL,finished_at REAL,error TEXT,
                UNIQUE(node_id,idempotency_key));
              CREATE UNIQUE INDEX IF NOT EXISTS telemetry_one_active ON telemetry_jobs(node_id)
                WHERE state IN ('QUEUED','PROVISIONING');
              CREATE TABLE IF NOT EXISTS telemetry_events(
                job_id TEXT NOT NULL,sequence INTEGER NOT NULL,timestamp REAL NOT NULL,
                level TEXT NOT NULL,step TEXT NOT NULL,message TEXT NOT NULL,
                PRIMARY KEY(job_id,sequence));
              CREATE TABLE IF NOT EXISTS telemetry_nodes(
                node_id TEXT PRIMARY KEY,state TEXT NOT NULL,detail TEXT NOT NULL,
                binding TEXT NOT NULL,checked_at REAL NOT NULL,job_id TEXT);
              CREATE TABLE IF NOT EXISTS telemetry_requests(
                node_id TEXT NOT NULL,request_key TEXT NOT NULL,job_id TEXT NOT NULL,
                PRIMARY KEY(node_id,request_key));
              CREATE TABLE IF NOT EXISTS telemetry_components(
                node_id TEXT PRIMARY KEY,data TEXT NOT NULL);
            ''')

    @contextmanager
    def tx(self, write=True):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            db.execute('PRAGMA busy_timeout=15000')
            if write: db.execute('BEGIN IMMEDIATE')
            yield db
            if write: db.commit()
        except BaseException:
            db.rollback()
            raise
        finally: db.close()

    def clean(self, text):
        return redact(text, (*environment_secrets(), *self.secrets()), limit=3000)

    def _event(self, db, job_id, level, step, message):
        seq = db.execute('SELECT COALESCE(MAX(sequence),0)+1 FROM telemetry_events WHERE job_id=?', (job_id,)).fetchone()[0]
        db.execute('INSERT INTO telemetry_events VALUES(?,?,?,?,?,?)', (job_id, seq, time.time(), level, step, self.clean(message)))

    def create(self, target, key):
        with self.tx() as db:
            row=db.execute('SELECT j.* FROM telemetry_requests r JOIN telemetry_jobs j ON j.job_id=r.job_id WHERE r.node_id=? AND r.request_key=?',
                           (target['node_id'],key)).fetchone()
            if row: return dict(row),False
            row = db.execute('SELECT * FROM telemetry_jobs WHERE node_id=? AND (idempotency_key=? OR state IN (?,?)) ORDER BY created_at DESC LIMIT 1',
                             (target['node_id'], key, *ACTIVE)).fetchone()
            if row:
                db.execute('INSERT INTO telemetry_requests VALUES(?,?,?)',(target['node_id'],key,row['job_id']))
                return dict(row), False
            job_id = uuid.uuid4().hex
            db.execute('INSERT INTO telemetry_jobs(job_id,node_id,chassis_id,project,binding,idempotency_key,state,created_at) VALUES(?,?,?,?,?,?,?,?)',
                       (job_id,target['node_id'],target['chassis_id'],target['project'],target['revision'],key,'QUEUED',time.time()))
            self._event(db,job_id,'INFO','QUEUED','Telemetry provision job created; waiting to start.')
            db.execute('INSERT INTO telemetry_requests VALUES(?,?,?)',(target['node_id'],key,job_id))
            return dict(db.execute('SELECT * FROM telemetry_jobs WHERE job_id=?',(job_id,)).fetchone()), True

    def get(self, job_id):
        with self.tx(False) as db:
            row = db.execute('SELECT * FROM telemetry_jobs WHERE job_id=?',(job_id,)).fetchone()
            if not row: raise KeyError(job_id)
            return dict(row)

    def latest(self, node_id):
        with self.tx(False) as db:
            row = db.execute('SELECT * FROM telemetry_jobs WHERE node_id=? ORDER BY created_at DESC LIMIT 1',(node_id,)).fetchone()
            return dict(row) if row else None

    def events(self, job_id, after=0, limit=500):
        with self.tx(False) as db:
            return [dict(r, schema_version=1) for r in db.execute('SELECT * FROM telemetry_events WHERE job_id=? AND sequence>? ORDER BY sequence LIMIT ?', (job_id, after, limit))]

    def step(self, job_id, step, message, level='STEP'):
        # This transaction commits BEFORE any mutating SSH step.
        with self.tx() as db:
            db.execute('UPDATE telemetry_jobs SET current_step=? WHERE job_id=?',(step,job_id))
            self._event(db,job_id,level,step,message)

    def claim(self, job_id):
        with self.tx() as db:
            return db.execute("UPDATE telemetry_jobs SET state='PROVISIONING',started_at=? WHERE job_id=? AND state='QUEUED'",(time.time(),job_id)).rowcount == 1

    def finish(self, job_id, state, message):
        with self.tx() as db:
            db.execute('UPDATE telemetry_jobs SET state=?,finished_at=?,error=? WHERE job_id=?', (state,time.time(),None if state=='READY' else self.clean(message),job_id))
            self._event(db,job_id,'PASS' if state=='READY' else 'WARN' if state=='DEGRADED' else 'FAIL',state,message)

    def health(self, target, state, detail, job_id=None):
        with self.tx() as db:
            db.execute('INSERT OR REPLACE INTO telemetry_nodes VALUES(?,?,?,?,?,?)', (target['node_id'],state,self.clean(detail),target['revision'],time.time(),job_id))

    def node(self, node_id):
        with self.tx(False) as db:
            row = db.execute('SELECT * FROM telemetry_nodes WHERE node_id=?',(node_id,)).fetchone()
            return dict(row) if row else None

    def components(self,node_id,value=None):
        with self.tx(value is not None) as db:
            if value is not None:
                db.execute('INSERT OR REPLACE INTO telemetry_components VALUES(?,?)',(node_id,json.dumps(value,ensure_ascii=False)))
                return value
            row=db.execute('SELECT data FROM telemetry_components WHERE node_id=?',(node_id,)).fetchone()
            return json.loads(row[0]) if row else {}

    def recover(self):
        # Called once by the exclusive service owner, never by a GET/reconnect.
        with self.tx() as db:
            rows = db.execute("SELECT job_id FROM telemetry_jobs WHERE state='PROVISIONING'").fetchall()
            for row in rows:
                message = 'Provision worker interrupted. History is retained. Enable Telemetry again to inspect the existing installation; installation is not replayed automatically.'
                db.execute("UPDATE telemetry_jobs SET state='INTERRUPTED',finished_at=?,error=? WHERE job_id=?", (time.time(),message,row['job_id']))
                self._event(db,row['job_id'],'WARN','INTERRUPTED',message)

    def queued(self, limit=2):
        with self.tx(False) as db:
            return [dict(r) for r in db.execute("SELECT * FROM telemetry_jobs WHERE state='QUEUED' ORDER BY created_at LIMIT ?",(limit,))]
