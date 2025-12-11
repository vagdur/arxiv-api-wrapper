// Main entry point for the arXiv API wrapper package
export { getArxivEntries } from './arxivAPIRead';
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

