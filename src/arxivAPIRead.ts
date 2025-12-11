import { ArxivQueryOptions, ArxivQueryResult, ArxivSearchFilters } from './types';
import { TokenBucketLimiter } from './rateLimiter';
import { fetchWithRetry } from './http';
import { parseEntries, parseFeedMeta } from './atom';

const ARXIV_BASE_URL = 'https://export.arxiv.org/api/query';

function encodeAuthor(term: string): string {
  // Always quote terms to match arXiv's expected format
  // Keep spaces - they'll be URL-encoded as %20
  const normalized = term.trim();
  return '"' + normalized + '"';
}

function encodePhrase(term: string, phraseExact?: boolean): string {
  // Always quote terms to match arXiv's expected format
  // Keep spaces - they'll be URL-encoded as %20
  const normalized = term.trim();
  return '"' + normalized + '"';
}

function fieldExpr(field: string, terms: string[] = [], phraseExact?: boolean): string[] {
  if (!terms.length) return [];
  if (field === 'au') {
    return terms.map((t) => `${field}:${encodeAuthor(t)}`);
  }
  return terms.map((t) => `${field}:${encodePhrase(t, phraseExact)}`);
}

function rangeExpr(field: string, from: string, to: string): string {
  return `${field}:[${from}+TO+${to}]`;
}

function groupOr(subfilters: string[]): string {
  if (subfilters.length === 0) return '';
  if (subfilters.length === 1) return subfilters[0];
  return `(${subfilters.join('+OR+')})`;
}

function groupParen(expr: string): string {
  return `(${expr})`;
}

function joinAnd(parts: string[]): string {
  return parts.filter(Boolean).join('+AND+');
}

/**
 * Builds an arXiv search query string from search filters.
 * 
 * This function converts the structured `ArxivSearchFilters` object into
 * a query string compatible with the arXiv API search syntax. Multiple terms
 * in the same field are combined with AND, and multiple fields are combined
 * with AND. OR groups and negation (ANDNOT) are also supported.
 * 
 * @param filters - Search filters to convert to query string
 * @returns URL-encoded query string ready for arXiv API
 * 
 * @example
 * ```typescript
 * const query = buildSearchQuery({
 *   title: ['machine learning'],
 *   author: ['Geoffrey Hinton'],
 * });
 * // Returns: "ti:\"machine learning\"+AND+au:\"Geoffrey Hinton\""
 * ```
 * 
 * @example
 * ```typescript
 * // Complex query with OR groups
 * const query = buildSearchQuery({
 *   or: [
 *     { title: ['quantum'] },
 *     { abstract: ['quantum'] },
 *   ],
 *   category: ['quant-ph'],
 * });
 * ```
 * 
 * @see {@link ArxivSearchFilters} for filter options
 */
export function buildSearchQuery(filters: ArxivSearchFilters): string {
  const parts: string[] = [];
  const phraseExact = filters.phraseExact;

  parts.push(...fieldExpr('all', filters.all, phraseExact)); // "all:" is supported per manual
  parts.push(...fieldExpr('ti', filters.title, phraseExact));
  parts.push(...fieldExpr('au', filters.author, phraseExact));
  parts.push(...fieldExpr('abs', filters.abstract, phraseExact));
  parts.push(...fieldExpr('co', filters.comment, phraseExact));
  parts.push(...fieldExpr('jr', filters.journalRef, phraseExact));
  parts.push(...fieldExpr('cat', filters.category, false));

  if (filters.submittedDateRange) {
    const { from, to } = filters.submittedDateRange;
    parts.push(rangeExpr('submittedDate', from, to));
  }

  // OR group: each subfilter becomes an AND-joined clause, then ORed as a group
  if (filters.or && filters.or.length > 0) {
    const orClauses = filters.or.map((sf) => buildSearchQuery({ ...sf, or: undefined, andNot: undefined }));
    const grouped = groupOr(orClauses);
    if (grouped) parts.push(grouped);
  }

  // Build the base query from regular parts
  const baseQuery = joinAnd(parts);

  // ANDNOT group: a single negated clause (appended separately, not joined with AND)
  if (filters.andNot) {
    const neg = buildSearchQuery({ ...filters.andNot, or: undefined, andNot: undefined });
    if (neg) {
      if (baseQuery) {
        return `${baseQuery}+ANDNOT+${groupParen(neg)}`;
      }
      return `ANDNOT+${groupParen(neg)}`;
    }
  }

  return baseQuery;
}

function buildUrl(opts: ArxivQueryOptions): string {
  const params: string[] = [];
  
  // Add id_list if it exists and has at least one item
  if (opts.idList && Array.isArray(opts.idList) && opts.idList.length > 0) {
    params.push('id_list=' + encodeURIComponent(opts.idList.join(',')));
  }
  
  // Add search_query if search is provided (can be used together with id_list)
  if (opts.search) {
    const q = buildSearchQuery(opts.search);
    // Encode the query properly: use encodeURIComponent to encode all special characters,
    // then replace %2B back to + so that + signs decode as spaces (arXiv expects spaces around AND/OR)
    const encodedQuery = encodeURIComponent(q).replace(/%2B/g, '+');
    params.push('search_query=' + encodedQuery);
  }
  if (typeof opts.start === 'number') params.push('start=' + String(opts.start));
  if (typeof opts.maxResults === 'number') params.push('max_results=' + String(opts.maxResults));
  if (opts.sortBy) params.push('sortBy=' + encodeURIComponent(opts.sortBy));
  if (opts.sortOrder) params.push('sortOrder=' + encodeURIComponent(opts.sortOrder));
  const qs = params.join('&');
  return `${ARXIV_BASE_URL}?${qs}`;
}

/**
 * Queries the arXiv API and returns matching paper entries.
 * 
 * This is the main function for interacting with the arXiv API. It supports
 * searching by various criteria, fetching specific papers by ID, pagination,
 * sorting, rate limiting, and automatic retries with exponential backoff.
 * 
 * @param options - Query options including search filters, pagination, and request configuration
 * @returns Promise resolving to query results with feed metadata and paper entries
 * 
 * @throws {Error} If the API request fails after all retries
 * @throws {Error} If the API returns a non-2xx status code
 * @throws {Error} If the API returns an empty response
 * 
 * @example
 * ```typescript
 * // Simple search
 * const result = await getArxivEntries({
 *   search: {
 *     title: ['quantum computing'],
 *     author: ['John Doe'],
 *   },
 *   maxResults: 10,
 * });
 * 
 * console.log(`Found ${result.feed.totalResults} papers`);
 * result.entries.forEach(entry => {
 *   console.log(`${entry.arxivId}: ${entry.title}`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Fetch specific papers by ID
 * const result = await getArxivEntries({
 *   idList: ['2101.01234', '2101.05678'],
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // With rate limiting and custom timeout
 * const result = await getArxivEntries({
 *   search: { title: ['neural networks'] },
 *   rateLimit: {
 *     tokensPerInterval: 1,
 *     intervalMs: 3000, // 1 request per 3 seconds
 *   },
 *   timeoutMs: 15000,
 *   retries: 5,
 * });
 * ```
 * 
 * @see {@link ArxivQueryOptions} for all available options
 * @see {@link ArxivQueryResult} for the return type structure
 * @see {@link ArxivSearchFilters} for search filter options
 */
export async function getArxivEntries(options: ArxivQueryOptions): Promise<ArxivQueryResult> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const retries = options.retries ?? 3;
  const userAgent = options.userAgent ?? 'arxiv-api-wrapper/1.0 (+https://export.arxiv.org)';

  const limiter = options.rateLimit
    ? new TokenBucketLimiter(options.rateLimit.tokensPerInterval, options.rateLimit.intervalMs)
    : undefined;

  const url = buildUrl(options);
  if (limiter) await limiter.acquire();

  const res = await fetchWithRetry(url, { method: 'GET', headers: { Accept: 'application/atom+xml' } }, { retries, timeoutMs, userAgent });
  
  // Check response status before parsing
  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unable to read error response');
    throw new Error(
      `arXiv API returned status ${res.status} ${res.statusText} for URL: ${url}. ` +
      `Response: ${errorText.substring(0, 500)}`
    );
  }
  
  const text = await res.text();
  
  // Log the response for debugging if it appears empty
  if (!text || text.trim().length === 0) {
    console.error(`Empty response from arXiv API. URL: ${url}, Status: ${res.status}`);
    throw new Error(`arXiv API returned empty response for URL: ${url}`);
  }

  const feed = parseFeedMeta(text);
  const entries = parseEntries(text);
  
  // Log if parsing resulted in empty data
  if (feed.totalResults === 0 && entries.length === 0 && text.length > 0) {
    console.warn(`Parsed empty results from non-empty response. URL: ${url}, Response length: ${text.length}`);
    console.warn(`Response preview (first 500 chars): ${text.substring(0, 500)}`);
  }
  
  return { feed, entries };
}

