/**
 * Integration tests for the arXiv OAI-PMH interface (real HTTP calls).
 * Conservative request size and rate; same pattern as arxivAPI.integration.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  oaiIdentify,
  oaiListRecords,
  oaiListRecordsAsyncIterator,
  oaiListRecordsAll,
  oaiListIdentifiersAsyncIterator,
  oaiListIdentifiersAll,
  oaiListSetsAsyncIterator,
  oaiListSetsAll,
} from '../src/oaiClient.js';

const OAI_OPTIONS = {
  timeoutMs: 15000,
  retries: 2,
  rateLimit: { tokensPerInterval: 1, intervalMs: 1000 },
  userAgent: 'arxiv-api-wrapper-tests/1.0',
};

describe('OAI-PMH integration', () => {
  it('oaiIdentify returns repository info and protocol version 2.0', async () => {
    let result;
    try {
      result = await oaiIdentify(OAI_OPTIONS);
    } catch (error) {
      console.error('oaiIdentify failed:', error);
      throw new Error(
        `OAI Identify failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    expect(result.repositoryName).toBeTruthy();
    expect(result.baseURL).toContain('oaipmh.arxiv.org');
    expect(result.protocolVersion).toBe('2.0');
    expect(Array.isArray(result.adminEmail)).toBe(true);
    expect(result.earliestDatestamp).toBeTruthy();
  }, 30000);

  it('oaiListRecords returns one page of records with header and metadata', async () => {
    let result;
    try {
      result = await oaiListRecords('oai_dc', {
        ...OAI_OPTIONS,
        from: '2024-01-01',
        until: '2024-01-02',
      });
    } catch (error) {
      console.error('oaiListRecords failed:', error);
      throw new Error(
        `OAI ListRecords failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    expect(Array.isArray(result.records)).toBe(true);
    if (result.records.length > 0) {
      const rec = result.records[0];
      expect(rec.header).toBeTruthy();
      expect(rec.header.identifier).toBeTruthy();
      expect(rec.header.datestamp).toBeTruthy();
      expect(rec.metadata).toBeDefined();
      expect(typeof rec.metadata).toBe('object');
    }
    // May or may not have resumptionToken depending on result size
    if (result.resumptionToken) {
      expect(result.resumptionToken.value).toBeTruthy();
    }
  }, 30000);

  it('oaiListRecordsAll returns records across all pages within a small date range', async () => {
    let result;
    try {
      result = await oaiListRecordsAll('oai_dc', {
        ...OAI_OPTIONS,
        from: '2024-01-01',
        until: '2024-01-02',
        maxRecords: 200,
      });
    } catch (error) {
      console.error('oaiListRecordsAll failed:', error);
      throw new Error(
        `OAI ListRecordsAll failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    expect(Array.isArray(result.records)).toBe(true);
    if (result.records.length > 0) {
      const rec = result.records[0];
      expect(rec.header).toBeTruthy();
      expect(rec.header.identifier).toBeTruthy();
      expect(rec.header.datestamp).toBeTruthy();
      expect(rec.metadata).toBeDefined();
      expect(typeof rec.metadata).toBe('object');
    }
  }, 30000);

  it('oaiListRecordsAsyncIterator yields records and matches oaiListRecordsAll count for the same cap', async () => {
    let iteratedRecords: unknown[] = [];
    let allResult;
    try {
      const maxRecords = 25;
      for await (const record of oaiListRecordsAsyncIterator('oai_dc', {
        ...OAI_OPTIONS,
        from: '2024-01-01',
        until: '2024-01-02',
        maxRecords,
      })) {
        iteratedRecords.push(record);
      }
      allResult = await oaiListRecordsAll('oai_dc', {
        ...OAI_OPTIONS,
        from: '2024-01-01',
        until: '2024-01-02',
        maxRecords,
      });
    } catch (error) {
      console.error('oaiListRecordsAsyncIterator failed:', error);
      throw new Error(
        `OAI ListRecordsAsyncIterator failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    expect(Array.isArray(iteratedRecords)).toBe(true);
    expect(iteratedRecords.length).toBeLessThanOrEqual(25);
    expect(iteratedRecords.length).toBe(allResult.records.length);
  }, 30000);

  it('oaiListIdentifiersAll returns headers across pages with maxHeaders cap', async () => {
    let result;
    try {
      result = await oaiListIdentifiersAll('oai_dc', {
        ...OAI_OPTIONS,
        from: '2024-01-01',
        until: '2024-01-02',
        maxHeaders: 50,
      });
    } catch (error) {
      console.error('oaiListIdentifiersAll failed:', error);
      throw new Error(
        `OAI ListIdentifiersAll failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    expect(Array.isArray(result.headers)).toBe(true);
    expect(result.headers.length).toBeLessThanOrEqual(50);
    if (result.headers.length > 0) {
      expect(result.headers[0].identifier).toBeTruthy();
      expect(result.headers[0].datestamp).toBeTruthy();
    }
  }, 30000);

  it('oaiListIdentifiersAsyncIterator yields headers and honors maxHeaders', async () => {
    const headers = [];
    try {
      for await (const header of oaiListIdentifiersAsyncIterator('oai_dc', {
        ...OAI_OPTIONS,
        from: '2024-01-01',
        until: '2024-01-02',
        maxHeaders: 20,
      })) {
        headers.push(header);
      }
    } catch (error) {
      console.error('oaiListIdentifiersAsyncIterator failed:', error);
      throw new Error(
        `OAI ListIdentifiersAsyncIterator failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    expect(Array.isArray(headers)).toBe(true);
    expect(headers.length).toBeLessThanOrEqual(20);
    if (headers.length > 0) {
      expect(headers[0].identifier).toBeTruthy();
      expect(headers[0].datestamp).toBeTruthy();
    }
  }, 30000);

  it('oaiListSetsAll returns sets with maxSets cap', async () => {
    let result;
    try {
      result = await oaiListSetsAll({
        ...OAI_OPTIONS,
        maxSets: 20,
      });
    } catch (error) {
      console.error('oaiListSetsAll failed:', error);
      throw new Error(
        `OAI ListSetsAll failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    expect(Array.isArray(result.sets)).toBe(true);
    expect(result.sets.length).toBeLessThanOrEqual(20);
    if (result.sets.length > 0) {
      expect(result.sets[0].setSpec).toBeTruthy();
      expect(result.sets[0].setName).toBeTruthy();
    }
  }, 30000);

  it('oaiListSetsAsyncIterator yields sets and honors maxSets', async () => {
    const sets = [];
    try {
      for await (const set of oaiListSetsAsyncIterator({
        ...OAI_OPTIONS,
        maxSets: 10,
      })) {
        sets.push(set);
      }
    } catch (error) {
      console.error('oaiListSetsAsyncIterator failed:', error);
      throw new Error(
        `OAI ListSetsAsyncIterator failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    expect(Array.isArray(sets)).toBe(true);
    expect(sets.length).toBeLessThanOrEqual(10);
    if (sets.length > 0) {
      expect(sets[0].setSpec).toBeTruthy();
      expect(sets[0].setName).toBeTruthy();
    }
  }, 30000);
});
