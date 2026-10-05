import type { PredictionSummary, Recommendation, UserProject } from './api';

export type Idea = Recommendation & { material: string; guideLabel: string };
export type SavedEntry = { record: PredictionSummary; idea?: Idea };

export function savedIdeas(records: PredictionSummary[], catalogIdeas: Idea[]): SavedEntry[] {
  return records.filter((record) => Boolean(record.selected_recommendation)).map((record) => {
    const recommendation = record.recommendation_choices?.find((candidate) => candidate.id === record.selected_recommendation)
      || catalogIdeas.find((candidate) => candidate.id === record.selected_recommendation);
    const idea: Idea | undefined = recommendation && { ...recommendation, material: record.title, guideLabel: record.title };
    return { record, idea };
  });
}

export function activeProjectsSorted(projects: UserProject[]): UserProject[] {
  return projects.filter((project) => project.status === 'active')
    .slice().sort((a, b) => b.progress_percent - a.progress_percent || b.updated_at.localeCompare(a.updated_at));
}
