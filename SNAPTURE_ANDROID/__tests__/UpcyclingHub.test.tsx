import React from 'react';
import Renderer from 'react-test-renderer';
import UpcyclingHub from '../src/UpcyclingHub';
import * as api from '../src/upcyclingApi';
jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:require('react-native').View,SafeAreaView:require('react-native').View}));
jest.mock('../src/api',()=>({...jest.requireActual('../src/api'),listProjects:jest.fn().mockResolvedValue([]),listSavedPredictions:jest.fn().mockResolvedValue([])}));
jest.mock('../src/upcyclingApi',()=>({listInventory:jest.fn().mockResolvedValue({lots:[{id:3,prediction_id:7,material:'paper',quantity:5,consumed:0,available:5,attributes:{}}]}),listCompletions:jest.fn().mockResolvedValue({completions:[]}),getCommunity:jest.fn().mockResolvedValue({programs:[],memberships:[],submissions:[],review_programs:[]}),upcyclingRequest:jest.fn().mockResolvedValue({prediction:{id:7,decision:'paper'}}),getSuggestions:jest.fn().mockResolvedValue({items:[],message:'No current project',facts:{}}),getVisual:jest.fn().mockResolvedValue({assessment:{observations:[],views:[],conflicts:[],facts:{},primary:{status:'unavailable'}}})}));
test('collection projects open a separate recommendation page with inventory enabled and all space sections navigate',async()=>{
 let tree!:Renderer.ReactTestRenderer;
 await Renderer.act(async()=>{tree=Renderer.create(<UpcyclingHub/>);});
 const press=async(label:string)=>Renderer.act(async()=>{const node=tree.root.findAllByProps({accessibilityLabel:label}).find(n=>typeof n.props.onPress==='function')!;expect(node).toBeDefined();await node.props.onPress();});
 await press('My collection and ratings');
 for(const removed of ['Programs','My Projects','Completed Projects','Saved/Favorite Projects','My Skills']){
   expect(tree.root.findAllByProps({accessibilityLabel:removed})).toHaveLength(0);
 }
 await press('Refresh my upcycling records');
 await press('Find projects for lot 3');
 expect(api.getSuggestions).toHaveBeenCalledWith(7,'',true);
 expect(tree.root.findAllByProps({accessibilityLabel:'Back to My Collection'}).length).toBeGreaterThan(0);
 await press('Back to My Collection');
 for(const tab of ['Ratings','Collection']){
   await press(tab);
   expect(tree.root.findAllByProps({accessibilityLabel:tab}).some(n=>n.props.accessibilityState?.selected)).toBe(true);
 }
 await press('Back to profile');
 expect(tree.root.findAllByProps({accessibilityLabel:'Refresh my upcycling records'})).toHaveLength(0);
 await Renderer.act(async()=>tree.unmount());
});
