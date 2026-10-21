import React from 'react';
import Renderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import App from '../App';
import { getCurrentUser, loginUser, registerUser } from '../src/api';

jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:({children}:{children:React.ReactNode})=>children,SafeAreaView:jest.requireActual('react-native').View}));
jest.mock('../src/MainExperience',()=>({MainExperience:()=>null,BottomNavigation:()=>null}));
jest.mock('../src/api',()=>({getCurrentUser:jest.fn().mockResolvedValue(null),loginUser:jest.fn(),registerUser:jest.fn()}));
function auth(tree:Renderer.ReactTestRenderer){return tree.root.find(node=>typeof node.type==='function' && node.type.name==='AuthScreen');}
function input(tree:Renderer.ReactTestRenderer,label:string){return tree.root.findAllByType(TextInput).find(node=>node.props.accessibilityLabel===label)!;}
async function press(tree:Renderer.ReactTestRenderer,label:string){await Renderer.act(()=>{tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!.props.onPress();});}
beforeEach(()=>{jest.clearAllMocks();(getCurrentUser as jest.Mock).mockResolvedValue(null);});

test.each(['login','register'])('%s password toggles without changing typed values or submitted credentials',async mode=>{
  (loginUser as jest.Mock).mockResolvedValue({user:{id:1}});
  (registerUser as jest.Mock).mockResolvedValue({user:{id:1}});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
  if(mode==='register')await Renderer.act(()=>auth(tree).props.onSwitch());
  await Renderer.act(()=>{auth(tree).props.setEmail('test@example.com');input(tree,'Password').props.onChangeText('example-password');});
  expect(input(tree,'Password').props.secureTextEntry).toBe(true);
  await press(tree,'Show password');
  expect(input(tree,'Password').props.secureTextEntry).toBe(false);
  expect(input(tree,'Password').props.value).toBe('example-password');
  if(mode==='register'){
    await Renderer.act(()=>input(tree,'Confirm password').props.onChangeText('example-password'));
    expect(input(tree,'Confirm password').props.secureTextEntry).toBe(true);
    await press(tree,'Show confirm password');
    expect(input(tree,'Confirm password').props.secureTextEntry).toBe(false);
    await press(tree,'Hide password');
    expect(input(tree,'Password').props.secureTextEntry).toBe(true);
    expect(input(tree,'Confirm password').props.secureTextEntry).toBe(false);
    await press(tree,'Hide confirm password');
  } else await press(tree,'Hide password');
  await Renderer.act(async()=>{await auth(tree).props.onSubmit();});
  if(mode==='login')expect(loginUser).toHaveBeenCalledWith('test@example.com','example-password');
  else expect(registerUser).toHaveBeenCalledWith('test@example.com','example-password','','');
  await Renderer.act(()=>tree.unmount());
});

test('switching between login and registration hides the password again',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
  await press(tree,'Show password');
  await Renderer.act(()=>auth(tree).props.onSwitch());
  expect(input(tree,'Password').props.secureTextEntry).toBe(true);
  expect(input(tree,'Confirm password').props.secureTextEntry).toBe(true);
  await Renderer.act(()=>tree.unmount());
});
