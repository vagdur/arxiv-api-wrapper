# arxiv-api-wrapper

A TypeScript package that provides a convenient wrapper around the arXiv API, enabling easy querying and parsing of arXiv papers.

## Installation

```bash
npm install arxiv-api-wrapper
```

## Quick Start

```typescript
import { getArxivEntries } from 'arxiv-api-wrapper';

const result = await getArxivEntries({
  search: {
    title: ['quantum computing'],
    author: ['John Doe'],
  },
  maxResults: 10,
  sortBy: 'submittedDate',
  sortOrder: 'descending',
});

console.log(`Found ${result.feed.totalResults} papers`);
result.entries.forEach(entry => {
  console.log(`${entry.arxivId}: ${entry.title}`);
});
```

## Features

- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **Flexible Search**: Support for complex queries with multiple filters, OR groups, and negation
- **Rate Limiting**: Built-in token bucket rate limiter to respect arXiv API guidelines
- **Retry Logic**: Automatic retries with exponential backoff for transient failures
- **Pagination**: Support for paginated results with configurable page size
- **Sorting**: Multiple sort options (relevance, submission date, last updated)

## API Reference

### `getArxivEntries(options: ArxivQueryOptions): Promise<ArxivQueryResult>`

Main function to query the arXiv API.

**Options:**
- `idList?: string[]` - List of arXiv IDs to fetch (e.g., `['2101.01234', '2101.05678']`)
- `search?: ArxivSearchFilters` - Search filters (ignored if `idList` is provided)
- `start?: number` - Pagination offset (0-based)
- `maxResults?: number` - Maximum number of results (≤ 300)
- `sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate'` - Sort field
- `sortOrder?: 'ascending' | 'descending'` - Sort direction
- `timeoutMs?: number` - Request timeout in milliseconds (default: 10000)
- `retries?: number` - Number of retry attempts (default: 3)
- `rateLimit?: { tokensPerInterval: number, intervalMs: number }` - Rate limit configuration
- `userAgent?: string` - Custom User-Agent header

**Search Filters:**
- `title?: string[]` - Search in titles
- `author?: string[]` - Search by author names
- `abstract?: string[]` - Search in abstracts
- `category?: string[]` - Filter by arXiv categories
- `submittedDateRange?: { from: string, to: string }` - Date range filter (YYYYMMDDTTTT format)
- `or?: ArxivSearchFilters[]` - OR group of filters
- `andNot?: ArxivSearchFilters` - Negated filter (ANDNOT)

**Returns:**
```typescript
{
  feed: {
    id: string;
    updated: string;
    title: string;
    link: string;
    totalResults: number;
    startIndex: number;
    itemsPerPage: number;
  };
  entries: Array<{
    id: string;
    arxivId: string;
    title: string;
    summary: string;
    published: string;
    updated: string;
    authors: Array<{ name: string; affiliation?: string }>;
    categories: string[];
    primaryCategory?: string;
    links: Array<{ href: string; rel?: string; type?: string; title?: string }>;
    doi?: string;
    journalRef?: string;
    comment?: string;
  }>;
}
```

## Examples

### Search by title and author

```typescript
const result = await getArxivEntries({
  search: {
    title: ['machine learning'],
    author: ['Geoffrey Hinton'],
  },
  maxResults: 5,
});
```

### Fetch specific papers by ID

```typescript
const result = await getArxivEntries({
  idList: ['2101.01234', '2101.05678'],
});
```

### Complex search with OR and date range

```typescript
const result = await getArxivEntries({
  search: {
    or: [
      { title: ['quantum'] },
      { abstract: ['quantum'] },
    ],
    submittedDateRange: {
      from: '202301010600',
      to: '202401010600',
    },
  },
  sortBy: 'submittedDate',
  sortOrder: 'descending',
});
```

### With rate limiting

```typescript
const result = await getArxivEntries({
  search: { title: ['neural networks'] },
  rateLimit: {
    tokensPerInterval: 1,
    intervalMs: 3000, // 1 request per 3 seconds
  },
});
```

## TypeScript Types

All types are exported from the package:

```typescript
import type {
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
} from 'arxiv-api-wrapper';
```

## License

ISC

## Author

Vilhelm Agdur

## Repository

https://github.com/vagdur/arxiv-api-wrapper
