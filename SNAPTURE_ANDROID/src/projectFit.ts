import type {Recommendation} from './api';

/** Practical checks, not dimensions inferred from a camera image. */
export function projectFit(idea:Recommendation):string[] {
  const id=idea.id;
  const size=id==='paper_craft'?'The clean paper pieces cover the collage or mosaic you want to make.'
    :id==='paper_gift_wrap'?'One usable sheet covers your gift with enough overlap for folding.'
    :id==='paper_organizer'?'The sheets are large and firm enough to fold the tray you want.'
    :id.startsWith('cardboard')?'The usable cardboard pieces fit your planned panels or templates.'
    :id.startsWith('fabric')?'The usable fabric covers your pattern, including space for seams or ties.'
    :id.startsWith('pete') || id.startsWith('hdpe')?'The container opening, capacity and shape fit the planned use.'
    :id.startsWith('coconut')?'The shell or shell pieces are large enough for the chosen design.'
    :id.startsWith('wood')?'The usable wood pieces meet your planned length, width and thickness.'
    :'The usable pieces fit the size and shape of the project you want to make.';
  return [size,
    /set|several|multiple/i.test(idea.title+' '+idea.summary)?'You have enough usable items for the whole set. If not, make one smaller item or choose another idea.':'You have enough usable material for one finished item; do not count stained or unusable portions.',
    'You have the listed tools and extra materials: '+idea.materials.join(', ')+'.'];
}
