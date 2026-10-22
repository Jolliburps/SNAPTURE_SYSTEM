"""Fetch small publisher annotations and licenses without downloading photo sets."""
import requests
from acquire_public_datasets import ROOT, checksum, download, save_json, SOURCES


def collect():
    taco=ROOT/'taco_metadata'
    taco.mkdir(parents=True,exist_ok=True)
    for name in ['annotations.json','README.md','LICENSE']:
        remote='data/'+name if name=='annotations.json' else name
        url='https://raw.githubusercontent.com/pedropro/TACO/master/'+remote
        download(url,taco/name)
    data=__import__('json').loads((taco/'annotations.json').read_text())
    save_json(taco/'acquisition.json',{'dataset':'TACO official annotation metadata only',
              'source':'https://github.com/pedropro/TACO','status':'metadata_only_photo_rights_hold',
              'image_files_downloaded':0,'catalogue_images':len(data['images']),
              'catalogue_annotations':len(data['annotations']),'catalogue_categories':len(data['categories']),
              'null_image_licenses':sum(row.get('license') is None for row in data['images']),
              'used_for_training':False,'reason':'Empty license table / null photo licenses in official metadata; do not infer photo rights from MIT code license.'})
    name='mmorwad_rgb'
    root=ROOT/name
    root.mkdir(parents=True,exist_ok=True)
    metadata=requests.get(SOURCES[name]['metadata'],timeout=45)
    metadata.raise_for_status()
    save_json(root/'publisher_metadata.json',metadata.json())
    files=[]
    for filename in SOURCES[name]['extra_files']:
        entry=next(row for row in metadata.json()['files'] if row['key']==filename)
        path=root/filename
        download(entry['links']['self'],path)
        algorithm,expected=entry['checksum'].split(':',1)
        if checksum(path,algorithm)!=expected:raise ValueError('Annotation checksum mismatch')
        files.append({'file':filename,'sha256':checksum(path),'publisher_checksum':entry['checksum']})
    save_json(root/'annotation_acquisition.json',{'dataset':name,'status':'annotations_verified_RGB_images_separate',
               'source':SOURCES[name]['page'],'license':SOURCES[name]['license'],'files':files,'used_for_training':False})
    print('TACO: official metadata only; no photos. MMoRWaD: verified annotations, object IDs and split metadata.',flush=True)


def collect_kaggle_hold():
    folder=ROOT/'kaggle_garbage_hold'
    url='https://www.kaggle.com/api/v1/datasets/view/mostafaabla/garbage-classification'
    response=requests.get(url,timeout=40)
    response.raise_for_status()
    save_json(folder/'publisher_metadata.json',response.json())
    save_json(folder/'acquisition.json',{'source':'https://www.kaggle.com/datasets/mostafaabla/garbage-classification',
              'status':'metadata_only_original_photo_rights_hold','image_files_downloaded':0,'used_for_training':False,
              'reason':'Publisher says web-scraped photos remain copyright original owners; normal clothing/shoe photos are not necessarily discarded waste.'})


if __name__=='__main__':
    collect()
    collect_kaggle_hold()
