import React from 'react';
import Renderer from 'react-test-renderer';
import {AppState} from 'react-native';
import LiveStepScanner from '../src/LiveStepScanner';
const button=(tree:Renderer.ReactTestRenderer,label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress)!;
beforeEach(()=>{AppState.currentState='active';jest.useFakeTimers();});afterEach(()=>jest.useRealTimers());
test('unavailable checker never submits evidence or displays a pass',async()=>{
 let tree!:Renderer.ReactTestRenderer;const frame=jest.fn();
 await Renderer.act(()=>{tree=Renderer.create(<LiveStepScanner instruction="Show the fold" available={false} reason="Approved checker unavailable" onFrame={frame} onClose={jest.fn()}/>);});
 await Renderer.act(()=>tree.root.findAll(n=>typeof n.props.onStarted==='function')[0].props.onStarted());
 expect(button(tree,'Start scanning').props.disabled).toBe(true);
 await Renderer.act(()=>jest.advanceTimersByTime(10000));expect(frame).not.toHaveBeenCalled();
 expect(JSON.stringify(tree.toJSON())).not.toContain('Step verified.');
 await Renderer.act(()=>tree.unmount());
});
test('live scan saves a selected frame and requires a server verification result',async()=>{
 let tree!:Renderer.ReactTestRenderer;const frame=jest.fn().mockResolvedValue({verified:true,message:'Required fold visible.'});
 await Renderer.act(()=>{tree=Renderer.create(<LiveStepScanner instruction="Show the fold" available onFrame={frame} onClose={jest.fn()}/>);});
 await Renderer.act(()=>tree.root.findAll(n=>typeof n.props.onStarted==='function')[0].props.onStarted());
 await Renderer.act(()=>button(tree,'Start scanning').props.onPress());
 await Renderer.act(async()=>{jest.advanceTimersByTime(900);});
 expect(frame).toHaveBeenCalledTimes(1);
 expect(JSON.stringify(tree.toJSON())).toContain('Step verified.');
 await Renderer.act(()=>jest.advanceTimersByTime(10000));expect(frame).toHaveBeenCalledTimes(1);
 await Renderer.act(()=>tree.unmount());
});

test('hidden details give guidance and allow a later frame instead of marking work failed',async()=>{
 let tree!:Renderer.ReactTestRenderer;const frame=jest.fn().mockResolvedValueOnce({verified:false,message:'Show the reverse side.',unavailable:false}).mockResolvedValueOnce({verified:true,message:'Required detail visible.'});
 await Renderer.act(()=>{tree=Renderer.create(<LiveStepScanner instruction="Show both tabs" available onFrame={frame} onClose={jest.fn()}/>);});
 await Renderer.act(()=>tree.root.findAll(n=>typeof n.props.onStarted==='function')[0].props.onStarted());
 await Renderer.act(()=>button(tree,'Start scanning').props.onPress());
 await Renderer.act(async()=>{jest.advanceTimersByTime(900);});
 expect(JSON.stringify(tree.toJSON())).toContain('Show the reverse side.');
 expect(JSON.stringify(tree.toJSON())).not.toContain('Step verified.');
 await Renderer.act(async()=>{jest.advanceTimersByTime(4100);});
 expect(frame).toHaveBeenCalledTimes(2);expect(JSON.stringify(tree.toJSON())).toContain('Step verified.');
 await Renderer.act(()=>tree.unmount());
});
