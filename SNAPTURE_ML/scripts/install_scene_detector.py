"""Explicit one-time model download. User photos never leave this computer."""
import json
from pathlib import Path
from huggingface_hub import HfApi, snapshot_download

repo = 'google/owlvit-base-patch32'
info = HfApi().model_info(repo)
target = Path(__file__).resolve().parents[1] / 'models' / 'owlvit-base-patch32'
snapshot_download(repo_id=repo, revision=info.sha, local_dir=target,
                  allow_patterns=['*.json','*.txt','*.safetensors','README.md','.gitattributes'])
(target / 'snapture_provenance.json').write_text(json.dumps({'repo':repo,'revision':info.sha,'license':'Apache-2.0','use':'Experimental zero-shot detection, not waste-validated; see model card.'},indent=2),encoding='utf-8')
print('Local detector installed:',target)
