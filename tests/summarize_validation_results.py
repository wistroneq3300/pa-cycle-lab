"""Compare JUnit test IDs, without double-counting subtest parent entries."""
import collections
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]/'artifacts/shared-validation/comparison'
def cases(path):
    result={}
    for case in ET.parse(path).iter('testcase'):
        status='failed' if case.find('failure') is not None else 'error' if case.find('error') is not None else 'skipped' if case.find('skipped') is not None else 'passed'
        key=case.get('classname')+'.'+case.get('name')
        if result.get(key) not in {'failed','error'}: result[key]=status
    return result

base=cases(ROOT/'baseline-integration.xml');current=cases(ROOT/'current-integration.xml')
data=dict(baseline_counts=dict(collections.Counter(base.values())),current_counts=dict(collections.Counter(current.values())),
          new_failures=[k for k,v in current.items() if v in {'failed','error'} and base.get(k) not in {'failed','error'}],
          retained_failure_ids=[k for k,v in current.items() if v in {'failed','error'} and base.get(k) in {'failed','error'}],
          new_pass_ids=[k for k,v in current.items() if k not in base and v=='passed'])
(ROOT/'final-delta.json').write_text(json.dumps(data,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in data.items() if not k.endswith('_ids')},indent=2))
