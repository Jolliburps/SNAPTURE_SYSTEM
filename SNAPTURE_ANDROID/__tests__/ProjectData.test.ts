import { activeProjectsSorted, savedIdeas } from '../src/projectData';
import type { PredictionSummary, UserProject } from '../src/api';

const makeProject = (id: number, progress: number, status: UserProject['status']): UserProject => ({
  id, source_prediction_id: id, recommendation_id: `idea-${id}`, title: `Project ${id}`, material: 'Cardboard',
  summary: '', materials: [], steps: ['Step one', 'Step two'], safety_note: '', completed_steps: [],
  completed_count: 0, total_steps: 2, progress_percent: progress, status,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
});

test('ongoing projects sort by actual progress without changing the source list', () => {
  const source = [makeProject(1, 25, 'active'), makeProject(2, 100, 'completed'), makeProject(3, 75, 'active')];
  expect(activeProjectsSorted(source).map((project) => project.id)).toEqual([3, 1]);
  expect(source.map((project) => project.id)).toEqual([1, 2, 3]);
});

test('a selected recommendation is saved without becoming an active project', () => {
  const scan: PredictionSummary = {
    id: 7, title: 'Cardboard', confidence: 0.8, created_at: '2026-10-01T00:00:00Z', image_url: null,
    selected_recommendation: 'cardboard_organizer',
    recommendation_choices: [{ id: 'cardboard_organizer', title: 'Drawer organizer', summary: 'Reuse a box.', materials: ['Cardboard'], steps: ['Measure the box.'] }],
  };
  expect(savedIdeas([scan], [])[0].idea?.title).toBe('Drawer organizer');
  expect(activeProjectsSorted([])).toEqual([]);
});
