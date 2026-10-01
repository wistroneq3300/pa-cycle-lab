"""Preview canonical migration without changing its input or printing secrets."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'app'))
from node_identity import migrate
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('inventory');args=parser.parse_args()
    original=json.loads(Path(args.inventory).read_text(encoding='utf-8'));result=migrate(original)
    nodes=[e for m in result['machines'].values() for e in m.get('os',[])]
    print(json.dumps(dict(schema_version=1,chassis=len(result['machines']),nodes=len(nodes),
        needs_physical_confirmation=sum(e.get('mapping_status')!='confirmed' for e in nodes),
        idempotent=migrate(result)==result,input_modified=False),indent=2))
