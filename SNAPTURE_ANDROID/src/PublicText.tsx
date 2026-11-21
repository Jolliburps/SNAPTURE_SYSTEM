import React from 'react';
import {Text,type TextProps} from 'react-native';

/** Presentation only: original records, source attribution and API values stay intact. */
export function neutralPublicText(value:string):string {
  if(/cesd/i.test(value) && /(?:supplied reference|user.supplied|source:|https?:\/\/|\.pdf|sha.?256)/i.test(value))return 'Source details are retained in the original record.';
  return value
    .replace(/^PETE$/i,'PETE (Polyethylene Terephthalate)')
    .replace(/^HDPE$/i,'HDPE (High-Density Polyethylene)')
    .replace(/\b(?:PET\/)?PETE bottles?\b(?!\s*\(polyethylene terephthalate\))/gi,'$& (Polyethylene Terephthalate)')
    .replace(/\bHDPE containers?\b(?!\s*\(high-density polyethylene\))/gi,'$& (High-Density Polyethylene)')
    .replace(/your barangay or Bacoor CESD/gi,'your barangay or local waste service')
    .replace(/your barangay or CESD/gi,'your barangay or local waste service')
    .replace(/(?:the )?CESD reference library/gi,'your local waste service')
    .replace(/not CESD approval/gi,'not an official approval')
    .replace(/or CESD approval/gi,'or official approval')
    .replace(/or CESD endorsement/gi,'or official endorsement')
    .replace(/expert or CESD approval/gi,'expert or official approval')
    .replace(/CESD approval/gi,'official approval')
    .replace(/\bCESD\b/gi,'local waste service');
}
function display(node:React.ReactNode):React.ReactNode {
  if(typeof node==='string')return neutralPublicText(node);
  if(Array.isArray(node))return node.map(display);
  return node;
}
export default function PublicText({children,...props}:TextProps){
  return <Text {...props}>{display(children)}</Text>;
}
