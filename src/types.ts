/**
 * Sort field options for arXiv query results.
 */
export type ArxivSortBy = 'relevance' | 'lastUpdatedDate' | 'submittedDate';

/**
 * Sort order direction for arXiv query results.
 */
export type ArxivSortOrder = 'ascending' | 'descending';

/**
 * Configuration for token bucket rate limiting.
 * 
 * @example
 * ```typescript
 * const rateLimit: ArxivRateLimitConfig = {
 *   tokensPerInterval: 1,
 *   intervalMs: 3000, // 1 request per 3 seconds
 * };
 * ```
 */
export interface ArxivRateLimitConfig {
  /** Number of tokens (requests) allowed per interval */
  tokensPerInterval: number;
  /** Interval duration in milliseconds */
  intervalMs: number;
}

/**
 * Date range filter for arXiv queries.
 * Dates must be in YYYYMMDDTTTT format (GMT timezone).
 * 
 * @example
 * ```typescript
 * const dateRange: ArxivDateRange = {
 *   from: '202301010600',
 *   to: '202401010600',
 * };
 * ```
 */
export interface ArxivDateRange {
  /** Start date in YYYYMMDDTTTT format (GMT) */
  from: string; // YYYYMMDDTTTT (GMT)
  /** End date in YYYYMMDDTTTT format (GMT) */
  to: string;   // YYYYMMDDTTTT (GMT)
}

/**
 * Search filters for querying arXiv papers.
 * Multiple terms in the same field are combined with AND.
 * Multiple fields are combined with AND.
 * 
 * @example
 * ```typescript
 * const filters: ArxivSearchFilters = {
 *   title: ['machine learning'],
 *   author: ['Geoffrey Hinton'],
 *   category: ['cs.LG'],
 * };
 * ```
 * 
 * @example
 * ```typescript
 * // Complex query with OR groups
 * const filters: ArxivSearchFilters = {
 *   or: [
 *     { title: ['quantum'] },
 *     { abstract: ['quantum'] },
 *   ],
 *   submittedDateRange: {
 *     from: '202301010600',
 *     to: '202401010600',
 *   },
 * };
 * ```
 * 
 * @see {@link ArxivDateRange} for date range format
 */
export interface ArxivSearchFilters {
  /** Search terms to match in all fields */
  all?: string[];
  /** Search terms to match in paper titles (arXiv field: ti:) */
  title?: string[]; // ti:
  /** Search terms to match author names (arXiv field: au:) */
  author?: string[]; // au:
  /** Search terms to match in abstracts (arXiv field: abs:) */
  abstract?: string[]; // abs:
  /** Search terms to match in comments (arXiv field: co:) */
  comment?: string[]; // co:
  /** Search terms to match in journal references (arXiv field: jr:) */
  journalRef?: string[]; // jr:
  /** arXiv category codes to filter by (arXiv field: cat:) */
  category?: string[]; // cat:
  /** Date range filter for submission dates (arXiv field: submittedDate:[from TO to]) */
  submittedDateRange?: ArxivDateRange; // submittedDate:[from TO to]

  // Composition
  /** OR group: at least one of the subfilters must match */
  or?: ArxivSearchFilters[]; // grouped OR of subfilters
  /** Negated filter: exclude papers matching this filter */
  andNot?: ArxivSearchFilters; // negated subfilter

  // Encoding behavior
  /** If true, wrap each search term in quotes for exact phrase matching */
  phraseExact?: boolean; // wrap each term in quotes
}

/**
 * Options for querying the arXiv API.
 * 
 * @example
 * ```typescript
 * const options: ArxivQueryOptions = {
 *   search: {
 *     title: ['quantum computing'],
 *     author: ['John Doe'],
 *   },
 *   maxResults: 10,
 *   sortBy: 'submittedDate',
 *   sortOrder: 'descending',
 * };
 * ```
 * 
 * @see {@link ArxivSearchFilters} for search filter details
 * @see {@link ArxivRateLimitConfig} for rate limiting configuration
 */
export interface ArxivQueryOptions {
  /** List of arXiv IDs to fetch directly (e.g., ['2101.01234', '2101.05678']). If provided, search filters are ignored. */
  idList?: string[];
  /** Search filters to query papers. Ignored if `idList` is provided. */
  search?: ArxivSearchFilters; // ignored if idList present
  /** Pagination offset (0-based index) */
  start?: number; // 0-based
  /** Maximum number of results to return (≤ 300 per arXiv API guidance) */
  maxResults?: number; // <= 300 per arXiv guidance
  /** Field to sort results by */
  sortBy?: ArxivSortBy;
  /** Sort order direction */
  sortOrder?: ArxivSortOrder;
  /** Request timeout in milliseconds (default: 10000) */
  timeoutMs?: number; // default 10000
  /** Number of retry attempts for failed requests (default: 3) */
  retries?: number; // default 3
  /** Rate limiting configuration to respect arXiv API guidelines */
  rateLimit?: ArxivRateLimitConfig;
  /** Custom User-Agent header for requests */
  userAgent?: string; // optional custom UA header
}

/**
 * Link metadata for an arXiv paper entry.
 * Links may point to the abstract page, PDF, source files, etc.
 */
export interface ArxivLink {
  /** URL of the link */
  href: string;
  /** Link relation type (e.g., 'alternate', 'related') */
  rel?: string;
  /** MIME type of the linked resource */
  type?: string;
  /** Human-readable title for the link */
  title?: string;
}

/**
 * Author information for an arXiv paper.
 */
export interface ArxivAuthor {
  /** Author's full name */
  name: string;
  /** Author's institutional affiliation (if provided) */
  affiliation?: string;
}

/**
 * Represents a single arXiv paper entry.
 * 
 * @example
 * ```typescript
 * const entry: ArxivEntry = {
 *   id: 'http://arxiv.org/abs/2101.01234v2',
 *   arxivId: '2101.01234v2',
 *   title: 'Example Paper Title',
 *   summary: 'Paper abstract...',
 *   published: '2021-01-01T12:00:00Z',
 *   updated: '2021-01-02T12:00:00Z',
 *   authors: [{ name: 'John Doe', affiliation: 'University' }],
 *   categories: ['cs.LG', 'cs.AI'],
 *   primaryCategory: 'cs.LG',
 *   links: [...],
 * };
 * ```
 */
export interface ArxivEntry {
  /** Full URL to the paper's abstract page */
  id: string; // abs URL
  /** arXiv ID including version (e.g., '2101.01234v2') */
  arxivId: string; // e.g., 2101.01234v2
  /** Paper title */
  title: string;
  /** Paper abstract/summary */
  summary: string;
  /** Publication date (ISO 8601 format) */
  published: string;
  /** Last update date (ISO 8601 format) */
  updated: string;
  /** List of paper authors */
  authors: ArxivAuthor[];
  /** arXiv category codes assigned to the paper */
  categories: string[];
  /** Primary arXiv category code */
  primaryCategory?: string;
  /** Links to abstract, PDF, source files, etc. */
  links: ArxivLink[];
  /** Digital Object Identifier (if published elsewhere) */
  doi?: string;
  /** Journal reference (if published) */
  journalRef?: string;
  /** Author comments about the paper */
  comment?: string;
}

/**
 * Metadata about the arXiv query feed/response.
 */
export interface ArxivFeedMeta {
  /** Feed identifier */
  id: string;
  /** Feed last update timestamp (ISO 8601 format) */
  updated: string;
  /** Feed title */
  title: string;
  /** Link to the query that generated this feed */
  link: string;
  /** Total number of results matching the query */
  totalResults: number;
  /** Starting index of results in this page (0-based) */
  startIndex: number;
  /** Number of items per page in this response */
  itemsPerPage: number;
}

/**
 * Complete result from an arXiv API query.
 * 
 * @example
 * ```typescript
 * const result: ArxivQueryResult = await getArxivEntries({
 *   search: { title: ['machine learning'] },
 *   maxResults: 10,
 * });
 * 
 * console.log(`Found ${result.feed.totalResults} papers`);
 * result.entries.forEach(entry => {
 *   console.log(`${entry.arxivId}: ${entry.title}`);
 * });
 * ```
 */
export interface ArxivQueryResult {
  /** Feed metadata and pagination information */
  feed: ArxivFeedMeta;
  /** Array of arXiv paper entries */
  entries: ArxivEntry[];
}

