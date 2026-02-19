/**
 * Integration tests for the arXiv OAI-PMH interface (real HTTP calls).
 * Conservative request size and rate; same pattern as arxivAPI.integration.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { oaiIdentify, oaiListRecords } from '../src/oaiClient.js';

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
});
