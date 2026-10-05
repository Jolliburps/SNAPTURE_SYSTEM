export type LocalUpdate = {
  id: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
};

// No administrator announcement source exists yet. Connect that API here
// when verified updates can be authored; the Home UI handles an empty list.
export async function getLocalUpdates(): Promise<LocalUpdate[]> {
  return [];
}
