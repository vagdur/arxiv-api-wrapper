# arxiv-api-wrapper

A TypeScript package that provides a convenient wrapper around the arXiv API, enabling easy querying and parsing of arXiv papers.

## Installation

```bash
npm install arxiv-api-wrapper
```

## Quick Start

```typescript
import { getArxivEntries, getArxivEntriesById } from 'arxiv-api-wrapper';

// Search for papers
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

// Or fetch specific papers by ID
const papers = await getArxivEntriesById(['2101.01234', '2101.05678']);
```

## Features

- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **Flexible Search**: Support for complex queries with multiple filters, OR groups, and negation
- **Rate Limiting**: Built-in token bucket rate limiter to respect arXiv API guidelines
- **Retry Logic**: Automatic retries with exponential backoff for transient failures
- **Pagination**: Support for paginated results with configurable page size
- **Sorting**: Multiple sort options (relevance, submission date, last updated)
- **OAI-PMH**: Support for the [arXiv Open Archives Initiative](https://info.arxiv.org/help/oa/index.html#open-archives-initiative-oai) interface (Identify, ListSets, GetRecord, ListRecords, ListIdentifiers, ListMetadataFormats)

## OAI-PMH interface

The package also supports the arXiv OAI-PMH endpoint (`https://oaipmh.arxiv.org/oai`), which is useful for metadata harvesting and bulk access. See the [arXiv OAI help](https://info.arxiv.org/help/oa/index.html#open-archives-initiative-oai) and the [OAI-PMH v2.0 protocol](https://www.openarchives.org/OAI/openarchivesprotocol.html) for details.

```typescript
import {
  oaiIdentify,
  oaiListRecords,
  oaiListRecordsAsyncIterator,
  oaiGetRecord,
  oaiListSets,
  oaiListIdentifiers,
  oaiListMetadataFormats,
} from 'arxiv-api-wrapper';

// Repository info
const identify = await oaiIdentify();
console.log(identify.repositoryName, identify.protocolVersion);

// One page of records (e.g. Dublin Core)
const result = await oaiListRecords('oai_dc', {
  from: '2024-01-01',
  until: '2024-01-31',
  set: 'math:math:LO',  // optional: restrict to a set
  rateLimit: { tokensPerInterval: 1, intervalMs: 1000 },
});
result.records.forEach((rec) => {
  console.log(rec.header.identifier, rec.metadata);
});
if (result.resumptionToken) {
  // Fetch next page with result.resumptionToken.value
}

// Single record by identifier (full or short form)
const record = await oaiGetRecord('cs/0112017', 'oai_dc');
```

For an intermediate option between manual page-by-page pagination and `*All` helpers, use async iterators:

```typescript
for await (const rec of oaiListRecordsAsyncIterator('oai_dc', {
  from: '2024-01-01',
  until: '2024-01-02',
  maxRecords: 50,
})) {
  console.log(rec.header.identifier);
}
```

The `oaiListRecordsAll` / `oaiListIdentifiersAll` / `oaiListSetsAll` helpers are convenience wrappers that collect from the corresponding async iterators.

All OAI functions accept optional `timeoutMs`, `retries`, `userAgent`, and `rateLimit` (same as the Atom API). OAI errors (e.g. `idDoesNotExist`, `noRecordsMatch`) are thrown as `OaiError` with a `code` and `messageText`.

## API Reference

For complete API documentation with detailed type information and examples, see the [generated API documentation](https://vagdur.github.io/arxiv-api-wrapper/).

### `getArxivEntriesById(ids: string[], options?): Promise<ArxivQueryResult>`

Simpler function to fetch arXiv papers by their IDs using the id_list API mode.

**Parameters:**
- `ids: string[]` - Array of arXiv paper IDs (e.g., `['2101.01234', '2101.05678']`)
- `options?: object` - Optional request configuration
  - `rateLimit?: { tokensPerInterval: number, intervalMs: number }` - Rate limit configuration
  - `retries?: number` - Number of retry attempts (default: 3)
  - `timeoutMs?: number` - Request timeout in milliseconds (default: 10000)
  - `userAgent?: string` - Custom User-Agent header

**Returns:** Same as `getArxivEntries` - see return type below.

### `getArxivEntries(options: ArxivQueryOptions): Promise<ArxivQueryResult>`

Main function to query the arXiv API with search filters or ID lists.

**Options:**
- `idList?: string[]` - List of arXiv IDs to fetch (e.g., `['2101.01234', '2101.05678']`)
- `search?: ArxivSearchFilters` - Search filters (when used with `idList`, filters the entries from `idList` to only return those matching the search query)
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

Using the simpler `getArxivEntriesById` function:

```typescript
const result = await getArxivEntriesById(['2101.01234', '2101.05678']);
```

Or using `getArxivEntries`:

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

### Fetch papers by ID with rate limiting

```typescript
const result = await getArxivEntriesById(
  ['2101.01234', '2101.05678'],
  {
    rateLimit: {
      tokensPerInterval: 1,
      intervalMs: 3000, // 1 request per 3 seconds
    },
    timeoutMs: 15000,
  }
);
```

### Search with rate limiting

```typescript
const result = await getArxivEntries({
  search: { title: ['neural networks'] },
  rateLimit: {
    tokensPerInterval: 1,
    intervalMs: 3000, // 1 request per 3 seconds
  },
});
```

## Documentation

### Generating API Documentation

To generate browsable API documentation from the source code:

```bash
npm run docs:generate
```

This will create HTML documentation in the `docs/` directory. You can then view it locally:

```bash
npm run docs:serve
```

The generated documentation includes:
- Complete API reference for all exported functions and types
- Detailed parameter descriptions and examples
- Type information and relationships
- Search functionality

### IDE IntelliSense

All exported functions and types include JSDoc comments for enhanced IDE IntelliSense support. Hover over any exported symbol in your IDE to see inline documentation.

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
  // OAI-PMH types
  OaiIdentifyResponse,
  OaiRecord,
  OaiHeader,
  OaiSet,
  OaiMetadataFormat,
  OaiResumptionToken,
  OaiListRecordsResult,
  OaiListIdentifiersResult,
  OaiListSetsResult,
  OaiRequestOptions,
  OaiListOptions,
  OaiErrorCode,
  OaiError
  } from 'arxiv-api-wrapper';
```

## License

ISC

## Author

Vilhelm Agdur

## Repository

https://github.com/vagdur/arxiv-api-wrapper
