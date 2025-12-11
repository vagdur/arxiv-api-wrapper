import { describe, it, test, expect } from 'vitest';
import { getArxivEntries } from '../src/arxivAPIRead';

// Integration tests that make real HTTP calls to arXiv API.
// These are intentionally conservative in request size and rate.

describe('arXiv API integration', () => {
  test('fetches results by search_query and then by id_list', async () => {
    console.log('Starting first API call (search query)...');
    let first;
    try {
      first = await getArxivEntries({
        search: {
          title: ['overlapping'],
          author: ['Vilhelm Agdur'],
        },
        start: 0,
        maxResults: 1,
        sortBy: 'submittedDate',
        sortOrder: 'descending',
        timeoutMs: 15000,
        retries: 2,
        rateLimit: { tokensPerInterval: 1, intervalMs: 1000 },
        userAgent: 'arxiv-api-wrapper-tests/1.0',
      });
      console.log('First API call completed successfully');
    } catch (error) {
      console.error('First API call failed:', error);
      throw new Error(`Failed to fetch search results: ${error instanceof Error ? error.message : String(error)}`);
    }

    expect(first.feed).toBeTruthy();
    expect(typeof first.feed.totalResults).toBe('number');
    expect(Array.isArray(first.entries)).toBe(true);
    expect(first.entries.length).toBeGreaterThanOrEqual(0);

    if (first.entries.length === 0) {
      const responseDetails = {
        feed: first.feed,
        totalResults: first.feed?.totalResults,
        entriesCount: first.entries.length,
        entries: first.entries,
      };
      console.error('No entries returned from search query. Response details:', JSON.stringify(responseDetails, null, 2));
      throw new Error(
        `Search query (title: "overlapping", author: "Vilhelm Agdur") returned no entries. ` +
        `Feed metadata: totalResults=${first.feed?.totalResults}, ` +
        `entries array length=${first.entries.length}. ` +
        `This indicates the API call succeeded but returned no results, which is unexpected.`
      );
    }

    // Verify the first result matches the search criteria
    const firstEntry = first.entries[0];
    
    // Check that the title contains "overlapping" (case-insensitive)
    const titleLower = firstEntry.title.toLowerCase();
    expect(titleLower).toContain('overlapping');
    
    // Check that at least one author is "Vilhelm Agdur"
    const authorNames = firstEntry.authors.map(a => a.name);
    const hasVilhelmAgdur = authorNames.some(name => 
      name.toLowerCase().includes('vilhelm') && name.toLowerCase().includes('agdur')
    );
    expect(hasVilhelmAgdur).toBe(true);
    
    // Log the actual result for debugging if needed
    console.log(`Verified result: title="${firstEntry.title}", authors=[${authorNames.join(', ')}]`);

    const arxivId = firstEntry.arxivId;
    if (!arxivId) {
      console.log('No arxivId found in first entry, skipping id_list test');
      return; // Skip id_list fetch if id is unavailable
    }

    console.log(`Starting second API call (id_list) for arxivId: ${arxivId}`);
    let second;
    try {
      second = await getArxivEntries({
        idList: [arxivId],
        timeoutMs: 15000,
        retries: 2,
        rateLimit: { tokensPerInterval: 1, intervalMs: 1000 },
        userAgent: 'arxiv-api-wrapper-tests/1.0',
      });
      console.log('Second API call completed successfully');
    } catch (error) {
      console.error('Second API call failed:', error);
      throw new Error(`Failed to fetch entry by id_list: ${error instanceof Error ? error.message : String(error)}`);
    }

    expect(second.entries.length).toBeGreaterThanOrEqual(1);
    expect(second.entries[0].arxivId).toBe(arxivId);
    expect(second.entries[0].title.length).toBeGreaterThan(0);
    expect(second.entries[0].links.length).toBeGreaterThanOrEqual(1);
  }, 120000); // Increased to 120 seconds to account for rate limiting, retries, and backoff delays
});

