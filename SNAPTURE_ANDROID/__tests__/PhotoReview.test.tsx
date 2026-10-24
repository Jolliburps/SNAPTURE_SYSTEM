import React from 'react';
import Renderer from 'react-test-renderer';
import { Image, Text } from 'react-native';
import { LiveQualityScreen } from '../App';
import { preparePrivatePreview } from '../src/api';

jest.mock('../src/api', () => ({...jest.requireActual('../src/api'), preparePrivatePreview:jest.fn()}));

test('photo review shows the local capture and allows analysis without a preview upload', async () => {
  const analyze=jest.fn();
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<LiveQualityScreen photoUri="file:///capture.jpg" error="" analyzing={false} onBack={jest.fn()} onContinue={analyze}/>);});
  expect(tree.root.findByType(Image).props.source.uri).toBe('file:///capture.jpg');
  expect(preparePrivatePreview).not.toHaveBeenCalled();
  const button=tree.root.findAll(node=>typeof node.props.onPress==='function' && node.findAllByType(Text).some(child=>child.props.children==='Analyze image'))[0];
  expect(button.props.disabled).toBeFalsy();
  await Renderer.act(()=>button.props.onPress());
  expect(analyze).toHaveBeenCalledTimes(1);
  await Renderer.act(()=>tree.unmount());
});
