"""Summarize researcher-recorded physical trials; never generate sample results."""
import argparse
import json
from pathlib import Path

LABELS=('pete_bottles','hdpe_containers','cardboard','paper','fabric_scraps','dry_untreated_wood_scraps','coconut_shells')
METRICS=('detection_correct','material_correct','condition_correct','suitability_correct','recommendation_relevant','quantity_match_correct','user_corrected','project_completed')

def report(path):
    rows=[];seen=set()
    for number,line in enumerate(path.read_text(encoding='utf-8').splitlines(),1):
        if not line.strip():continue
        row=json.loads(line)
        if row.get('category') not in LABELS or not isinstance(row.get('trial_id'),str) or not row['trial_id'].strip():raise ValueError(f'Line {number}: category and trial ID required.')
        if row['trial_id'] in seen:raise ValueError('Duplicate trial ID.')
        seen.add(row['trial_id'])
        if row.get('actual_material_trial') is not True:raise ValueError('Only actual physical-material trials belong in this report.')
        evidence=row.get('evidence_file')
        if not isinstance(evidence,str) or not (path.parent/evidence).is_file():raise ValueError('Each trial needs an existing evidence file, relative to the trial log.')
        if any(k in row and row[k] is not None and type(row[k]) is not bool for k in METRICS):raise ValueError('Metrics must be true, false, or null for unmeasured.')
        if row.get('satisfaction') is not None and (type(row['satisfaction']) is not int or not 1<=row['satisfaction']<=5):raise ValueError('Satisfaction must be an integer from 1 to 5 or null.')
        rows.append(row)
    def summarize(group):
        output={'trials':len(group)}
        for metric in METRICS:
            measured=[r[metric] for r in group if r.get(metric) is not None]
            output[metric]={'n':len(measured),'positive':sum(measured),'rate':sum(measured)/len(measured) if measured else None}
        satisfaction=[r['satisfaction'] for r in group if r.get('satisfaction') is not None]
        output['satisfaction']={'n':len(satisfaction),'mean':sum(satisfaction)/len(satisfaction) if satisfaction else None}
        return output
    return {'basis':'Researcher-recorded physical trials; evidence-file presence is not independent verification of labels.',
            'overall':summarize(rows),'categories':{label:summarize([r for r in rows if r['category']==label]) for label in LABELS}}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('trials',type=Path);parser.add_argument('--output',type=Path)
    args=parser.parse_args();result=json.dumps(report(args.trials),indent=2)
    if args.output:args.output.write_text(result,encoding='utf-8')
    else:print(result)
