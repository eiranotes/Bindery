import { writable } from 'svelte/store';

export const episodeStore = writable<{
  currentEpisode: string;
  tabs: string[];
  activeTab: string;
}>({
  currentEpisode: 'ep001',
  tabs: ['index.md', 'manuscript.md', 'context.md', 'qa.md', 'revision.md'],
  activeTab: 'manuscript.md'
});
