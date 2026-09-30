"""Backend-only credential file loader. No secret values in error messages."""
import json
import os
import stat
from .settings import DATA


def validate_permissions(metadata, uid):
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid!=uid or metadata.st_mode & 0o077:
        raise PermissionError('Credential file must be a regular file owned by the service account with mode 0600 or stricter')


def load_credentials():
    path=DATA/'credentials.json'
    try:
        if path.is_symlink(): raise PermissionError('Credential symlink is forbidden')
        fd=os.open(path,os.O_RDONLY|getattr(os,'O_NOFOLLOW',0))
        with os.fdopen(fd,'r',encoding='utf-8') as stream:
            if os.name=='posix': validate_permissions(os.fstat(stream.fileno()),os.getuid())
            data=json.load(stream)
        if not isinstance(data,dict): raise ValueError('Invalid credential configuration')
        return data
    except (OSError,ValueError) as exc:
        raise PermissionError('Backend credential file unavailable or unsafe') from None
