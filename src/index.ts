/**
 * @packageDocumentation
 * 
 * # arxiv-api-wrapper
 * 
 * A TypeScript package that provides a convenient wrapper around the arXiv API,
 * enabling easy querying and parsing of arXiv papers.
 * 
 * ## Features
 * 
 * - **Type-safe**: Full TypeScript support with comprehensive type definitions
 * - **Flexible Search**: Support for complex queries with multiple filters, OR groups, and negation
 * - **Rate Limiting**: Built-in token bucket rate limiter to respect arXiv API guidelines
 * - **Retry Logic**: Automatic retries with exponential backoff for transient failures
 * - **Pagination**: Support for paginated results with configurable page size
 * - **Sorting**: Multiple sort options (relevance, submission date, last updated)
 * 
 * ## Quick Start
 * 
 * ```typescript
 * import { getArxivEntries } from 'arxiv-api-wrapper';
 * 
 * const result = await getArxivEntries({
 *   search: {
 *     title: ['quantum computing'],
 *     author: ['John Doe'],
 *   },
 *   maxResults: 10,
 *   sortBy: 'submittedDate',
 *   sortOrder: 'descending',
 * });
 * 
 * console.log(`Found ${result.feed.totalResults} papers`);
 * result.entries.forEach(entry => {
 *   console.log(`${entry.arxivId}: ${entry.title}`);
 * });
 * ```
 * 
 * @module arxiv-api-wrapper
 */

// Main entry point for the arXiv API wrapper package
export { getArxivEntries, getArxivEntriesById } from './arxivAPIRead';
export type {
  ArxivQueryOptions,
  ArxivQueryResult,
  ArxivSearchFilters,
  ArxivEntry,
  ArxivFeedMeta,
  ArxivAuthor,
  ArxivLink,
  ArxivSortBy,
  ArxivSortOrder,
  ArxivRateLimitConfig,
  ArxivDateRange,
} from './types';

