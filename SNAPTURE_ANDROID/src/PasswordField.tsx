import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Eye from 'lucide-react-native/icons/eye';
import EyeOff from 'lucide-react-native/icons/eye-off';

export default function PasswordField({label,value,onChangeText,placeholder,style,newPassword=false}:{label:string;value:string;onChangeText:(value:string)=>void;placeholder:string;style?:StyleProp<ViewStyle>;newPassword?:boolean}) {
  const [visible,setVisible]=useState(false);
  return <View style={[style,s.field]}>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9aa9a0" secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete={newPassword?'new-password':'current-password'} textContentType={newPassword?'newPassword':'password'} style={s.input}/>
    <Pressable accessibilityRole="button" accessibilityLabel={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} accessibilityState={{checked:visible}} onPress={()=>setVisible(previous=>!previous)} style={s.toggle}>
      {visible?<EyeOff size={22} color="#176b45"/>:<Eye size={22} color="#176b45"/>}
    </Pressable>
  </View>;
}
const s=StyleSheet.create({field:{flexDirection:'row',alignItems:'center'},input:{flex:1,minWidth:0,minHeight:48,color:'#24352c',paddingVertical:10,paddingLeft:0,paddingRight:8,fontSize:14},toggle:{minWidth:44,minHeight:48,alignItems:'center',justifyContent:'center'}});
