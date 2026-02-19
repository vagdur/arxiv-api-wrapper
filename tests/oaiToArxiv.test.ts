import { describe, expect, it } from 'vitest';
import {
  oaiListRecordsToArxivQueryResult,
  oaiRecordToArxivEntry,
  oaiRecordsToArxivEntries,
} from '../src/oaiToArxiv.js';
import type { OaiListRecordsResult, OaiRecord } from '../src/oaiTypes.js';

describe('oai->arxiv conversion helpers', () => {
  it('converts arXiv metadata record to ArxivEntry shape', () => {
    const record: OaiRecord = {
      header: {
        identifier: 'oai:arXiv.org:2501.12345',
        datestamp: '2025-01-10',
        setSpec: ['cs'],
      },
      metadata: {
        arXiv: {
          id: '2501.12345v2',
          created: '2025-01-01',
          updated: '2025-01-09',
          title: 'Example Paper',
          abstract: 'Example abstract',
          categories: 'cs.AI cs.LG',
          comments: '12 pages',
          doi: '10.1000/example',
          'journal-ref': 'J. Examples 1 (2025)',
          authors: {
            author: [
              { keyname: 'Doe', forenames: 'Jane', affiliation: ['University A'] },
              { keyname: 'Smith', forenames: 'John' },
            ],
          },
        },
      },
    };

    const entry = oaiRecordToArxivEntry(record);
    expect(entry).not.toBeNull();
    expect(entry?.arxivId).toBe('2501.12345v2');
    expect(entry?.id).toBe('https://arxiv.org/abs/2501.12345v2');
    expect(entry?.published).toBe('2025-01-01');
    expect(entry?.updated).toBe('2025-01-09');
    expect(entry?.authors).toEqual([
      { name: 'Jane Doe', affiliation: 'University A' },
      { name: 'John Smith' },
    ]);
    expect(entry?.categories).toEqual(['cs.AI', 'cs.LG']);
    expect(entry?.primaryCategory).toBe('cs.AI');
    expect(entry?.doi).toBe('10.1000/example');
    expect(entry?.journalRef).toBe('J. Examples 1 (2025)');
    expect(entry?.comment).toBe('12 pages');
  });

  it('converts arXivRaw versions and appends latest version suffix', () => {
    const record: OaiRecord = {
      header: {
        identifier: 'oai:arXiv.org:hep-th/9901001',
        datestamp: '1999-12-26',
        setSpec: ['physics:hep-th'],
      },
      metadata: {
        arXivRaw: {
          id: 'hep-th/9901001',
          submitter: 'Example User',
          version: [
            { version: 'v1', date: '1999-12-25' },
            { version: 'v2', date: '1999-12-26' },
          ],
          title: 'Raw Title',
          abstract: 'Raw abstract',
          authors: 'Alice A., Bob B.',
          categories: 'hep-th',
        },
      },
    };

    const entry = oaiRecordToArxivEntry(record);
    expect(entry).not.toBeNull();
    expect(entry?.arxivId).toBe('hep-th/9901001v2');
    expect(entry?.published).toBe('1999-12-25');
    expect(entry?.updated).toBe('1999-12-26');
    expect(entry?.authors).toEqual([{ name: 'Alice A.' }, { name: 'Bob B.' }]);
  });

  it('converts list result to ArxivQueryResult and skips deleted records', () => {
    const result: OaiListRecordsResult = {
      records: [
        {
          header: {
            identifier: 'oai:arXiv.org:2101.01234',
            datestamp: '2021-01-10',
            setSpec: ['cs'],
          },
          metadata: {
            dc: {
              title: 'DC title',
              creator: ['Author One'],
              subject: ['cs.AI'],
              description: 'DC abstract',
              date: '2021-01-09',
            },
          },
        },
        {
          header: {
            identifier: 'oai:arXiv.org:2101.09999',
            datestamp: '2021-01-11',
            setSpec: ['cs'],
            status: 'deleted',
          },
        },
      ],
      resumptionToken: {
        value: 'next-token',
        cursor: 10,
        completeListSize: 250,
      },
    };

    const entries = oaiRecordsToArxivEntries(result.records);
    expect(entries).toHaveLength(1);

    const queryResult = oaiListRecordsToArxivQueryResult(result);
    expect(queryResult.entries).toHaveLength(1);
    expect(queryResult.entries[0].title).toBe('DC title');
    expect(queryResult.feed.totalResults).toBe(250);
    expect(queryResult.feed.itemsPerPage).toBe(1);
    expect(queryResult.feed.startIndex).toBe(9);
  });
});
