"""Opt-in terminal event retention. Never deletes reports or evidence."""
import argparse
from pathlib import Path
import sys
import time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from integration.store import Store, TERMINAL

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--days',type=int,default=90)
    parser.add_argument('--apply',action='store_true',help='Compact; default only lists eligible terminal jobs')
    args=parser.parse_args()
    if args.days<1: parser.error('--days must be at least 1')
    store=Store();before=time.time()-args.days*86400
    if args.apply: print('Events removed:',store.compact_events(before))
    else:
        for job in store.jobs():
            if job['state'] in TERMINAL and job['updated_at']<before:print(job['id'],job['state'])
