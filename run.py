"""Usage: python run.py web [--port 9180] | runner | demo."""
import argparse
import os
from integration.settings import ROOT, MODE

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('command',choices=['web','runner','demo'])
    parser.add_argument('--port',type=int,default=9180)
    args=parser.parse_args()
    if args.command=='demo':
        if MODE!='synthetic': parser.error('demo requires CYCLE_MODE=synthetic')
        from scripts.bootstrap import bootstrap
        bootstrap()
    elif args.command=='runner':
        from integration.runner import service
        service()
    else:
        import socket
        with socket.socket() as sock:
            try: sock.bind(('127.0.0.1',args.port))
            except OSError: parser.error(f'Port {args.port} is occupied; choose --port <free-port>')
        import uvicorn
        uvicorn.run('integration.web:app',host='127.0.0.1',port=args.port)
