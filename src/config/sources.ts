export interface NewsSource {
  name: string;
  url: string;
  type: 'RSS' | 'NITTER';
}

export const DEFAULT_SOURCES: NewsSource[] = [
  { 
    name: 'Towards Data Science', 
    url: 'https://towardsdatascience.com/feed', 
    type: 'RSS' 
  },
  { 
    name: 'Hugging Face Blog', 
    url: 'https://huggingface.co/blog/feed.xml', 
    type: 'RSS' 
  },
  { 
    name: 'Google DeepMind Blog', 
    url: 'https://blog.google/technology/google-deepmind/rss/', 
    type: 'RSS' 
  },
  // Future sources can be added here
]; 