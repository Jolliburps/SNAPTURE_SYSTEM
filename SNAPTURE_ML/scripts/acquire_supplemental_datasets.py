"""Public publisher APIs only; no keys, private Drive files or web image scraping."""
from pathlib import Path
import time
import requests
from acquire_public_datasets import ROOT, download, extract, inventory, checksum, save_json


def acquire_mendeley(name, source):
    root = ROOT / name; root.mkdir(parents=True, exist_ok=True)
    ident, version = source['dataset_id'], source['version']
    base = f'https://data.mendeley.com/public-api/datasets/{ident}'
    metadata_response = requests.get(f'{base}?version={version}', timeout=45)
    metadata_response.raise_for_status(); metadata = metadata_response.json()
    if metadata.get('data_licence', {}).get('short_name') != 'CC BY 4.0':
        raise ValueError('Publisher licence changed; review before downloading.')
    files_response = requests.get(f'{base}/files?folder_id=root&version={version}', timeout=45)
    files_response.raise_for_status(); files = files_response.json()
    save_json(root / 'publisher_metadata.json', metadata)
    save_json(root / 'publisher_files.json', files)
    state = {'dataset':name, **source, 'retrieved_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
             'status':'downloading','used_for_training':False,'published_to_github':False}
    save_json(root / 'acquisition.json', state)
    archives = []
    try:
        for entry in files:
            filename = entry['filename']
            if Path(filename).name != filename or not filename.lower().endswith('.zip'): continue
            details = entry['content_details']
            if details['size'] > 1024**3: raise ValueError('Supplement exceeds the 1 GiB-per-archive limit.')
            path = root / filename
            download(details['download_url'], path)
            if checksum(path) != details['sha256_hash']: raise ValueError('Publisher SHA256 mismatch.')
            extract(path, root / 'extracted')
            archives.append({'filename':filename,'sha256':details['sha256_hash'],'bytes':path.stat().st_size})
        result = inventory(root / 'extracted')
        if not result['image_files']: raise ValueError('No readable images available; source remains held.')
        save_json(root / 'image_inventory.json', result)
        state.update({key:value for key,value in result.items() if key != 'images'})
        state.update(status='downloaded_unreviewed', archives=archives)
    except Exception as error:
        state.update(status='incomplete',error=str(error))
        raise
    finally:
        save_json(root / 'acquisition.json', state)
    print(name, result['image_files'], 'readable images; not yet trained', flush=True)
    return state
