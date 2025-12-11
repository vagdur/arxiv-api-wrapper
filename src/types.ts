export type ArxivSortBy = 'relevance' | 'lastUpdatedDate' | 'submittedDate';
export type ArxivSortOrder = 'ascending' | 'descending';

export interface ArxivRateLimitConfig {
  tokensPerInterval: number;
  intervalMs: number;
}

export interface ArxivDateRange {
  from: string; // YYYYMMDDTTTT (GMT)
  to: string;   // YYYYMMDDTTTT (GMT)
}

export interface ArxivSearchFilters {
  all?: string[];
  title?: string[]; // ti:
  author?: string[]; // au:
  abstract?: string[]; // abs:
  comment?: string[]; // co:
  journalRef?: string[]; // jr:
  category?: string[]; // cat:
  submittedDateRange?: ArxivDateRange; // submittedDate:[from TO to]

  // Composition
  or?: ArxivSearchFilters[]; // grouped OR of subfilters
  andNot?: ArxivSearchFilters; // negated subfilter

  // Encoding behavior
  phraseExact?: boolean; // wrap each term in quotes
}

export interface ArxivQueryOptions {
  idList?: string[];
  search?: ArxivSearchFilters; // ignored if idList present
  start?: number; // 0-based
  maxResults?: number; // <= 300 per arXiv guidance
  sortBy?: ArxivSortBy;
  sortOrder?: ArxivSortOrder;
  timeoutMs?: number; // default 10000
  retries?: number; // default 3
  rateLimit?: ArxivRateLimitConfig;
  userAgent?: string; // optional custom UA header
}

export interface ArxivLink {
  href: string;
  rel?: string;
  type?: string;
  title?: string;
}

export interface ArxivAuthor {
  name: string;
  affiliation?: string;
}

export interface ArxivEntry {
  id: string; // abs URL
  arxivId: string; // e.g., 2101.01234v2
  title: string;
  summary: string;
  published: string;
  updated: string;
  authors: ArxivAuthor[];
  categories: string[];
  primaryCategory?: string;
  links: ArxivLink[];
  doi?: string;
  journalRef?: string;
  comment?: string;
}

export interface ArxivFeedMeta {
  id: string;
  updated: string;
  title: string;
  link: string;
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
}

export interface ArxivQueryResult {
  feed: ArxivFeedMeta;
  entries: ArxivEntry[];
}

