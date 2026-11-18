import React from 'react';
import Renderer from 'react-test-renderer';
import PreparationSteps from '../src/PreparationSteps';
test('one readiness check follows preparation and can return to steps without saving',async()=>{
  const complete=jest.fn(),edit=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<PreparationSteps plan={{title:'Dry paper',steps:['Air dry.']}} busy={false} onComplete={complete} onEdit={edit}/>);});
  const press=async(label:string)=>{await Renderer.act(()=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>typeof n.props.onPress==='function')!.props.onPress());};
  await press('Preparation finished');expect(complete).not.toHaveBeenCalled();
  await press('Not ready yet');expect(JSON.stringify(tree.toJSON())).toContain('Air dry.');
  await press('Preparation finished');await press('Correct preparation condition');expect(edit).toHaveBeenCalledTimes(1);
  await press('Confirm preparation readiness');expect(complete).toHaveBeenCalledTimes(1);
  await Renderer.act(()=>tree.unmount());
});
