import { getAnnouncements, type Announcement } from './api';
export type LocalUpdate = Announcement;

export async function getLocalUpdates(): Promise<LocalUpdate[]> {
  return (await getAnnouncements()).entries;
}
