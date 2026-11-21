import React from 'react';
import Renderer from 'react-test-renderer';
import PublicText,{neutralPublicText} from '../src/PublicText';

test('resident wording keeps handling instructions and does not relabel a source as another authority',()=>{
  expect(neutralPublicText('Keep it separate. Ask your barangay or CESD for handling.')).toBe('Keep it separate. Ask your barangay or local waste service for handling.');
  expect(neutralPublicText('CESD supplied reference: Original.pdf; edition SHA-256 abc')).toBe('Source details are retained in the original record.');
  expect(neutralPublicText('AI checking unavailable.')).toBe('AI checking unavailable.');
});
test('saved record copy is neutral only when displayed',async()=>{
  const record={source:'User-supplied CESD interview',instructions:['Keep it separate. Ask CESD for instructions.']};
  const original=JSON.stringify(record);let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<PublicText>{record.instructions[0]}</PublicText>);});
  expect(JSON.stringify(tree.toJSON())).not.toContain('CESD');
  expect(JSON.stringify(record)).toBe(original);
  await Renderer.act(()=>tree.unmount());
});
