export type ConditionChoice={label:string;values:Record<string,string>};
const values=(condition:string,contamination:string,moisture:string):Record<string,string>=>({condition,contamination,moisture});
const clean={...values('Clean and dry','None known','Dry'),previous_contents:'No chemical contact known'};
const wet=values('Needs cleaning','None known','Wet');
const damaged=values('Damaged or cracked','None known','Dry');
const residue=values('Needs cleaning','Food residue that can be removed','Not sure');
const dirty=values('Moldy or contaminated','Oil or grease','Not sure');
const mold=values('Moldy or contaminated','Mold or biological waste','Not sure');
const chemical={...values('Moldy or contaminated','Chemical contamination','Not sure'),previous_contents:'Chemical or cleaning product'};
const unknown=values('Not sure','Not sure','Not sure');
const profiles:Record<string,{title:string;choices:ConditionChoice[]}>= {
  paper:{title:'What condition is the paper in?',choices:[
    {label:'Clean and dry paper',values:clean},{label:'Wet, but no stains or residue',values:wet},
    {label:'Torn or crumpled, but clean and dry',values:{...clean,condition:'Torn or crumpled, clean and dry'}},
    {label:'Paper with food or grease stains',values:dirty},{label:'Paper with mold',values:mold}]},
  cardboard:{title:'What condition is the cardboard in?',choices:[
    {label:'Clean and dry cardboard',values:clean},{label:'Wet cardboard, without food or grease',values:wet},
    {label:'Torn or crushed cardboard, but clean and dry',values:{...clean,condition:'Clean dry usable scraps'}},
    {label:'Cardboard with food or grease stains',values:dirty},{label:'Cardboard with mold',values:mold}]},
  pete_bottles:{title:'What condition is the PETE bottle in?',choices:[
    {label:'Empty, clean and dry bottle',values:clean},{label:'Empty bottle, still wet inside',values:wet},
    {label:'Bottle with food or drink residue',values:residue},{label:'Cracked or damaged bottle',values:damaged}]},
  hdpe_containers:{title:'What condition is the HDPE container in?',choices:[
    {label:'Empty, clean and dry container',values:clean},{label:'Empty container, still wet inside',values:wet},
    {label:'Container with food or drink residue',values:residue},{label:'Cracked or leaking container',values:damaged}]},
  fabric_scraps:{title:'What condition is the fabric in?',choices:[
    {label:'Clean and dry fabric',values:clean},{label:'Wet fabric, without stains',values:wet},
    {label:'Torn or frayed fabric, but clean and dry',values:{...clean,condition:'Clean dry usable scraps'}},
    {label:'Fabric with oil or grease stains',values:dirty},{label:'Fabric with mold',values:mold}]},
  coconut_shells:{title:'What condition is the coconut shell in?',choices:[
    {label:'Clean and dry shell, without coconut flesh',values:clean},{label:'Clean shell, still wet',values:wet},
    {label:'Shell with coconut flesh or food residue',values:residue},{label:'Cracked shell or sharp broken pieces',values:damaged},
    {label:'Shell with mold',values:mold}]},
  dry_untreated_wood_scraps:{title:'What condition is the wood in?',choices:[
    {label:'Clean and dry wood',values:clean},{label:'Damp wood',values:wet},
    {label:'Split or splintered wood',values:damaged},{label:'Wood with mold or rot',values:mold}]},
};

export function materialConditions(label:string):{title:string;choices:ConditionChoice[]}|null{
  const profile=profiles[label];
  if(!profile)return null;
  // Preserve backend condition codes; wording does not certify material history,
  // remove project suitability checks, or turn torn material into a clean project.
  return {title:profile.title,choices:[...profile.choices,
    {label:'Known contact with a chemical or cleaning product',values:chemical},
    {label:'Not sure about its condition',values:unknown}]};
}
