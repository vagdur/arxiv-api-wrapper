/**
 * Unit tests for OAI-PMH URL builder and XML parser (no network).
 */
import { describe, it, expect } from 'vitest';
import { buildOaiUrl, normalizeOaiIdentifier } from '../src/oaiClient.js';
import {
  parseIdentify,
  parseListMetadataFormats,
  parseListSets,
  parseGetRecord,
  parseListIdentifiers,
  parseListRecords,
  parseOaiResponse,
} from '../src/oaiParser.js';
import { OaiError } from '../src/oaiTypes.js';

const OAI_BASE = 'https://oaipmh.arxiv.org/oai';

describe('buildOaiUrl', () => {
  it('includes verb only for Identify', () => {
    const url = buildOaiUrl('Identify', {});
    expect(url).toBe(`${OAI_BASE}?verb=Identify`);
  });

  it('encodes identifier and metadataPrefix for GetRecord', () => {
    const url = buildOaiUrl('GetRecord', {
      identifier: 'oai:arXiv.org:cs/0112017',
      metadataPrefix: 'oai_dc',
    });
    expect(url).toContain('verb=GetRecord');
    expect(url).toContain('identifier=' + encodeURIComponent('oai:arXiv.org:cs/0112017'));
    expect(url).toContain('metadataPrefix=oai_dc');
  });

  it('includes from, until, set for ListRecords', () => {
    const url = buildOaiUrl('ListRecords', {
      metadataPrefix: 'oai_dc',
      from: '2024-01-01',
      until: '2024-01-31',
      set: 'cs:cs.AI',
    });
    expect(url).toContain('verb=ListRecords');
    expect(url).toContain('metadataPrefix=oai_dc');
    expect(url).toContain('from=2024-01-01');
    expect(url).toContain('until=2024-01-31');
    expect(url).toContain('set=cs%3Acs.AI');
  });

  it('encodes resumptionToken', () => {
    const token = 'token/with/slashes?and=chars';
    const url = buildOaiUrl('ListIdentifiers', { metadataPrefix: 'oai_dc', resumptionToken: token });
    expect(url).toContain('resumptionToken=' + encodeURIComponent(token));
  });
});

describe('normalizeOaiIdentifier', () => {
  it('returns full form unchanged', () => {
    expect(normalizeOaiIdentifier('oai:arXiv.org:cs/0112017')).toBe('oai:arXiv.org:cs/0112017');
  });

  it('prefixes short form', () => {
    expect(normalizeOaiIdentifier('cs/0112017')).toBe('oai:arXiv.org:cs/0112017');
    expect(normalizeOaiIdentifier('2101.01234')).toBe('oai:arXiv.org:2101.01234');
  });
});

function wrapOaiRoot(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <responseDate>2024-01-15T12:00:00Z</responseDate>
  <request verb="Identify">${OAI_BASE}</request>
  ${inner}
</OAI-PMH>`;
}

describe('parseIdentify', () => {
  it('parses Identify response', () => {
    const xml = wrapOaiRoot(`
  <Identify>
    <repositoryName>arXiv</repositoryName>
    <baseURL>https://oaipmh.arxiv.org/oai</baseURL>
    <protocolVersion>2.0</protocolVersion>
    <adminEmail>help@arxiv.org</adminEmail>
    <earliestDatestamp>2005-09-16</earliestDatestamp>
    <deletedRecord>persistent</deletedRecord>
    <granularity>YYYY-MM-DD</granularity>
  </Identify>`);
    const out = parseIdentify(xml);
    expect(out.repositoryName).toBe('arXiv');
    expect(out.baseURL).toBe('https://oaipmh.arxiv.org/oai');
    expect(out.protocolVersion).toBe('2.0');
    expect(out.adminEmail).toEqual(['help@arxiv.org']);
    expect(out.earliestDatestamp).toBe('2005-09-16');
    expect(out.deletedRecord).toBe('persistent');
    expect(out.granularity).toBe('YYYY-MM-DD');
  });
});

describe('parseListMetadataFormats', () => {
  it('parses ListMetadataFormats response', () => {
    const inner = `
  <ListMetadataFormats>
    <metadataFormat>
      <metadataPrefix>oai_dc</metadataPrefix>
      <schema>http://www.openarchives.org/OAI/2.0/oai_dc.xsd</schema>
      <metadataNamespace>http://www.openarchives.org/OAI/2.0/oai_dc/</metadataNamespace>
    </metadataFormat>
    <metadataFormat>
      <metadataPrefix>arXiv</metadataPrefix>
      <schema>https://arxiv.org/schemas/arXiv.xsd</schema>
      <metadataNamespace>http://arxiv.org/schemas/arXiv/</metadataNamespace>
    </metadataFormat>
  </ListMetadataFormats>`;
    const xml = wrapOaiRoot(inner).replace('<request verb="Identify">', '<request verb="ListMetadataFormats">');
    const out = parseListMetadataFormats(xml);
    expect(out).toHaveLength(2);
    expect(out[0].metadataPrefix).toBe('oai_dc');
    expect(out[1].metadataPrefix).toBe('arXiv');
  });
});

describe('parseListSets', () => {
  it('parses sets and resumptionToken', () => {
    const inner = `
  <ListSets>
    <set>
      <setSpec>cs</setSpec>
      <setName>Computer Science</setName>
    </set>
    <set>
      <setSpec>physics</setSpec>
      <setName>Physics</setName>
    </set>
    <resumptionToken expirationDate="2024-01-16T00:00:00Z" completeListSize="42" cursor="2">next-token</resumptionToken>
  </ListSets>`;
    const xml = wrapOaiRoot(inner).replace('<request verb="Identify">', '<request verb="ListSets">');
    const out = parseListSets(xml);
    expect(out.sets).toHaveLength(2);
    expect(out.sets[0].setSpec).toBe('cs');
    expect(out.sets[0].setName).toBe('Computer Science');
    expect(out.resumptionToken?.value).toBe('next-token');
    expect(out.resumptionToken?.expirationDate).toBe('2024-01-16T00:00:00Z');
    expect(out.resumptionToken?.completeListSize).toBe(42);
    expect(out.resumptionToken?.cursor).toBe(2);
  });
});

describe('parseGetRecord', () => {
  it('parses GetRecord with header and metadata', () => {
    const inner = `
  <GetRecord>
    <record>
      <header>
        <identifier>oai:arXiv.org:cs/0112017</identifier>
        <datestamp>2001-12-14</datestamp>
        <setSpec>cs</setSpec>
        <setSpec>math</setSpec>
      </header>
      <metadata>
        <dc xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:title>Using Structural Metadata to Localize Experience of Digital Content</dc:title>
          <dc:creator>Dushay, Naomi</dc:creator>
          <dc:date>2001-12-14</dc:date>
        </dc>
      </metadata>
    </record>
  </GetRecord>`;
    const xml = wrapOaiRoot(inner).replace('<request verb="Identify">', '<request verb="GetRecord" identifier="oai:arXiv.org:cs/0112017" metadataPrefix="oai_dc">');
    const out = parseGetRecord(xml);
    expect(out.header.identifier).toBe('oai:arXiv.org:cs/0112017');
    expect(out.header.datestamp).toBe('2001-12-14');
    expect(out.header.setSpec).toEqual(['cs', 'math']);
    expect(out.metadata).toBeDefined();
    expect(Object.keys(out.metadata!).length).toBeGreaterThan(0);
  });
});

describe('parseListIdentifiers', () => {
  it('parses headers', () => {
    const inner = `
  <ListIdentifiers>
    <header>
      <identifier>oai:arXiv.org:hep-th/9901001</identifier>
      <datestamp>1999-12-25</datestamp>
      <setSpec>physics:hep-th</setSpec>
    </header>
    <header>
      <identifier>oai:arXiv.org:hep-th/9901002</identifier>
      <datestamp>1999-12-26</datestamp>
    </header>
  </ListIdentifiers>`;
    const xml = wrapOaiRoot(inner).replace('<request verb="Identify">', '<request verb="ListIdentifiers" metadataPrefix="oai_dc">');
    const out = parseListIdentifiers(xml);
    expect(out.headers).toHaveLength(2);
    expect(out.headers[0].identifier).toBe('oai:arXiv.org:hep-th/9901001');
    expect(out.headers[0].setSpec).toEqual(['physics:hep-th']);
  });
});

describe('parseListRecords', () => {
  it('parses records and resumptionToken', () => {
    const inner = `
  <ListRecords>
    <record>
      <header>
        <identifier>oai:arXiv.org:cs/0112017</identifier>
        <datestamp>2001-12-14</datestamp>
        <setSpec>cs</setSpec>
      </header>
      <metadata>
        <dc><dc:title>Test Paper</dc:title></dc>
      </metadata>
    </record>
    <resumptionToken cursor="1">resume-123</resumptionToken>
  </ListRecords>`;
    const xml = wrapOaiRoot(inner).replace('<request verb="Identify">', '<request verb="ListRecords" metadataPrefix="oai_dc">');
    const out = parseListRecords(xml);
    expect(out.records).toHaveLength(1);
    expect(out.records[0].header.identifier).toBe('oai:arXiv.org:cs/0112017');
    expect(out.resumptionToken?.value).toBe('resume-123');
    expect(out.resumptionToken?.cursor).toBe(1);
  });
});

describe('OAI error handling', () => {
  it('throws OaiError with code and message on error element', () => {
    const xml = wrapOaiRoot(`<error code="idDoesNotExist">No matching identifier in arXiv</error>`);
    expect(() => parseOaiResponse(xml)).toThrow(OaiError);
    try {
      parseOaiResponse(xml);
    } catch (e) {
      expect(e).toBeInstanceOf(OaiError);
      expect((e as OaiError).code).toBe('idDoesNotExist');
      expect((e as OaiError).messageText).toContain('No matching identifier');
    }
  });

  it('throws OaiError for noRecordsMatch', () => {
    const xml = wrapOaiRoot(`<error code="noRecordsMatch"/>`);
    expect(() => parseIdentify(xml)).toThrow(OaiError);
    try {
      parseOaiResponse(xml);
    } catch (e) {
      expect((e as OaiError).code).toBe('noRecordsMatch');
    }
  });
});
