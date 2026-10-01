"""Workspace-only temporary directories, including restricted Windows runners.

Python's Windows mkdir(mode=0o700) ACL excludes the runner's restricted SID.
Use an ordinary inherited workspace ACL for synthetic, non-secret test data.
"""
import shutil
import uuid
from pathlib import Path


class WorkspaceTemporaryDirectory:
    def __init__(self):
        root = Path(__file__).resolve().parent / 'tmp'
        root.mkdir(exist_ok=True)
        self.path = root / ('test-' + uuid.uuid4().hex)
        self.path.mkdir()
        self.name = str(self.path)

    def cleanup(self):
        root = Path(__file__).resolve().parent / 'tmp'
        resolved = self.path.resolve()
        if resolved.parent != root.resolve() or not resolved.name.startswith('test-'):
            raise RuntimeError('Test cleanup target escaped workspace')
        if resolved.exists():
            shutil.rmtree(resolved)

    def __enter__(self):
        return self.name

    def __exit__(self, *args):
        self.cleanup()
