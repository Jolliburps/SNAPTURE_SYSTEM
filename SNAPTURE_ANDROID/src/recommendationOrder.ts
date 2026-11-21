import type {Recommendation} from './api';

/** Display priority only: never adds choices or changes the server's eligibility. */
export function photoFirstRecommendations<T extends Recommendation>(ideas:readonly T[]):T[] {
  const priority=(idea:T)=>{
    if(!idea.steps?.length || !idea.steps.every(step=>typeof step==='string' && step.trim()))return -1;
    const finished=Boolean(idea.photos?.finished.url);
    const process=Boolean(idea.photos?.steps.some(photo=>photo.url && typeof photo.step_index==='number' && Number.isInteger(photo.step_index) && photo.step_index >= 0 && photo.step_index < idea.steps.length));
    return process?2:finished?1:0;
  };
  return ideas.map((idea,index)=>({idea,index,priority:priority(idea)}))
    .sort((a,b)=>b.priority-a.priority || a.index-b.index).map(row=>row.idea);
}
