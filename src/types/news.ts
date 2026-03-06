export interface NewsItem {
  title: string;
  content: string;
  date: string;
}

export interface NewsData {
  news: NewsItem[];
}