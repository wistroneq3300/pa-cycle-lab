"""Local administrator CLI. Does not connect to hardware or edit inventory."""
import argparse
import difflib
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from integration.settings import DATA
from integration.store import Store
from integration import profiles


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['export','validate','diff','activate'])
    parser.add_argument('--file',type=Path)
    parser.add_argument('--project-id')
    args=parser.parse_args()
    if args.command=='export':
        content=json.dumps(profiles.default_package(),ensure_ascii=False,indent=2)+'\n'
        if args.file:
            with args.file.open('x',encoding='utf-8') as stream:stream.write(content)
            print('Created UTF-8 profile:',args.file)
        else:print(content,end='')
        return
    if not args.file:parser.error('--file is required')
    package=profiles.validate(json.loads(args.file.read_text(encoding='utf-8-sig')))
    if args.command=='validate':
        frozen=profiles.freeze(package,'local-file')
        print('VALID schema; execution dependencies frozen:',frozen['content_hash'])
        print('Schema validity does not verify hardware selectors or power scope.');return
    if not args.project_id:parser.error('--project-id is required')
    document=json.loads((DATA/'data.json').read_text(encoding='utf-8'))
    project=next((p for p in document.get('projects',{}).values() if p.get('project_id')==args.project_id),None)
    if project is None:parser.error('Stable Project ID is not in this instance inventory')
    store=Store()
    if args.command=='diff':
        with store.tx(write=False) as db:current=profiles.resolve(db,args.project_id,project.get('cycle_profile'))
        before=json.dumps(current['package'] if current else {},indent=2,sort_keys=True).splitlines()
        after=json.dumps(package,indent=2,sort_keys=True).splitlines()
        print('\n'.join(difflib.unified_diff(before,after,fromfile='active',tofile=str(args.file))))
    else:
        profiles.activate(store,args.project_id,package)
        print('Activated for future runs only:',args.project_id,package['profile_id'],package['revision'])


if __name__=='__main__':main()
