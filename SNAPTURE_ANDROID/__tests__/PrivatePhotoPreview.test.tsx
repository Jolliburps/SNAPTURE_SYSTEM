import React from 'react';
import Renderer from 'react-test-renderer';
import { Image } from 'react-native';
import PrivatePhotoPreview from '../src/PrivatePhotoPreview';
import { preparePrivatePreview } from '../src/api';

jest.mock('../src/api',()=>({preparePrivatePreview:jest.fn()}));
const safe='data:image/jpeg;base64,cHJvdGVjdGVk';

test('raw camera URI is never displayed while privacy processing is pending',async()=>{
  let finish!:(value:unknown)=>void;
  (preparePrivatePreview as jest.Mock).mockReturnValue(new Promise(resolve=>{finish=resolve;}));
  const onBusyChange=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<PrivatePhotoPreview uri="file:///private-capture.jpg" onBusyChange={onBusyChange}/>);});
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('file:///private-capture.jpg');
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  await Renderer.act(async()=>finish({preview_uri:safe,faces_blurred:2}));
  expect(tree.root.findByType(Image).props.source.uri).toBe(safe);
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  await Renderer.act(()=>tree.unmount());
});

test('privacy failure hides the image, permits results without a preview and allows a retry',async()=>{
  (preparePrivatePreview as jest.Mock).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue({preview_uri:safe,faces_blurred:0});
  const busy=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<PrivatePhotoPreview uri="file:///original.jpg" onBusyChange={busy}/>);});
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('analyze without a photo preview');
  expect(busy).toHaveBeenLastCalledWith(false);
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Retry photo privacy'}).find(node=>node.props.onPress)!.props.onPress());
  expect(tree.root.findByType(Image).props.source.uri).toBe(safe);
  await Renderer.act(()=>tree.unmount());
});

test('unexpected preview data never falls back to an unprocessed local file',async()=>{
  (preparePrivatePreview as jest.Mock).mockResolvedValue({preview_uri:'file:///original.jpg'});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<PrivatePhotoPreview uri="file:///original.jpg" onBusyChange={jest.fn()}/>);});
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});
