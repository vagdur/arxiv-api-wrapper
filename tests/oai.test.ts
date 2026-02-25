/**
 * Unit tests for OAI-PMH URL builder and XML parser (no network).
 * Pagination helpers (oaiListRecordsAll, etc.) are covered by integration tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildOaiUrl,
  normalizeOaiIdentifier,
  oaiListIdentifiers,
  oaiListRecords,
  oaiListRecordsAsyncIterator,
} from '../src/oaiClient.js';
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

afterEach(() => {
  vi.restoreAllMocks();
});

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
    const url = buildOaiUrl('ListIdentifiers', { resumptionToken: token });
    expect(url).toContain('resumptionToken=' + encodeURIComponent(token));
  });

  it('throws for resumptionToken combined with other params', () => {
    expect(() =>
      buildOaiUrl('ListRecords', {
        metadataPrefix: 'oai_dc',
        from: '2024-01-01',
        resumptionToken: 'next-token',
      })
    ).toThrow(OaiError);
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

describe('noRecordsMatch returns empty list (wrapper behaviour)', () => {
  it('oaiListRecords returns { records: [] } when server responds noRecordsMatch', async () => {
    const noRecordsMatchXml = wrapOaiRoot(`<error code="noRecordsMatch"/>`);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(noRecordsMatchXml, { status: 200 })
    );

    const result = await oaiListRecords('oai_dc', {
      from: '2006-01-01',
      until: '2006-01-02',
    });

    expect(result).toEqual({ records: [] });
    expect(result.records).toHaveLength(0);
  });

  it('oaiListIdentifiers returns { headers: [] } when server responds noRecordsMatch', async () => {
    const noRecordsMatchXml = wrapOaiRoot(`<error code="noRecordsMatch"/>`);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(noRecordsMatchXml, { status: 200 })
    );

    const result = await oaiListIdentifiers('oai_dc', {
      from: '2006-01-01',
      until: '2006-01-02',
    });

    expect(result).toEqual({ headers: [] });
    expect(result.headers).toHaveLength(0);
  });
});

describe('resumptionToken validation', () => {
  it('throws a local OaiError when resumptionToken is combined with from in oaiListRecords', async () => {
    const invalidOptions = {
      from: '2024-01-01',
      resumptionToken: 'resume-token',
    } as unknown as Parameters<typeof oaiListRecords>[1];

    await expect(
      oaiListRecords('oai_dc', invalidOptions)
    ).rejects.toMatchObject({
      name: 'OaiError',
      code: 'badArgument',
    });
    await expect(oaiListRecords('oai_dc', invalidOptions)).rejects.toThrow(
      'resumptionToken must be used by itself'
    );
  });

  it('throws a local OaiError when resumptionToken is combined with set in oaiListIdentifiers', async () => {
    const invalidOptions = {
      set: 'cs:cs:AI',
      resumptionToken: 'resume-token',
    } as unknown as Parameters<typeof oaiListIdentifiers>[1];

    await expect(
      oaiListIdentifiers('oai_dc', invalidOptions)
    ).rejects.toMatchObject({
      name: 'OaiError',
      code: 'badArgument',
    });
  });
});

describe('from date validation', () => {
  it('throws a local OaiError when from is earlier than arXiv minimum date', async () => {
    await expect(
      oaiListRecords('oai_dc', { from: '2005-09-15' })
    ).rejects.toMatchObject({
      name: 'OaiError',
      code: 'badArgument',
    });
    await expect(oaiListRecords('oai_dc', { from: '2005-09-15' })).rejects.toThrow(
      "earlier than arXiv's earliest supported OAI datestamp (2005-09-16)"
    );
  });

  it('throws for earlier datetime form and allows earliest date', async () => {
    await expect(
      oaiListIdentifiers('oai_dc', { from: '2005-09-15T23:59:59Z' })
    ).rejects.toMatchObject({
      name: 'OaiError',
      code: 'badArgument',
    });
    const url = buildOaiUrl('ListIdentifiers', { metadataPrefix: 'oai_dc', from: '2005-09-16' });
    expect(url).toContain('from=2005-09-16');
  });
});

describe('until date validation', () => {
  it('throws a local OaiError when until is in the future', async () => {
    const tomorrowUtc = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await expect(
      oaiListRecords('oai_dc', { until: tomorrowUtc })
    ).rejects.toMatchObject({
      name: 'OaiError',
      code: 'badArgument',
    });
    await expect(oaiListRecords('oai_dc', { until: tomorrowUtc })).rejects.toThrow(
      "later than today's UTC date"
    );
  });

  it('throws for future datetime form and allows today', async () => {
    const tomorrowUtc = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const todayUtc = new Date().toISOString().slice(0, 10);

    await expect(
      oaiListIdentifiers('oai_dc', { until: `${tomorrowUtc}T00:00:00Z` })
    ).rejects.toMatchObject({
      name: 'OaiError',
      code: 'badArgument',
    });
    const url = buildOaiUrl('ListIdentifiers', { metadataPrefix: 'oai_dc', until: todayUtc });
    expect(url).toContain(`until=${todayUtc}`);
  });
});

describe('resumptionToken expiration handling in iterators', () => {
  it('fails fast locally when continuation token is already expired', async () => {
    const firstPageXml = wrapOaiRoot(`
  <ListRecords>
    <record>
      <header>
        <identifier>oai:arXiv.org:test/0001</identifier>
        <datestamp>2024-01-01</datestamp>
      </header>
      <metadata><dc><dc:title>Page 1</dc:title></dc></metadata>
    </record>
    <resumptionToken expirationDate="2000-01-01T00:00:00Z">expired-token</resumptionToken>
  </ListRecords>`).replace(
      '<request verb="Identify">',
      '<request verb="ListRecords" metadataPrefix="oai_dc">'
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(firstPageXml, { status: 200 }));

    const iterator = oaiListRecordsAsyncIterator('oai_dc', { retries: 0, timeoutMs: 1000 });
    const first = await iterator.next();
    expect(first.done).toBe(false);

    await expect(iterator.next()).rejects.toMatchObject({
      name: 'OaiError',
      code: 'badResumptionToken',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('continues when continuation token expirationDate is in the future', async () => {
    const firstPageXml = wrapOaiRoot(`
  <ListRecords>
    <record>
      <header>
        <identifier>oai:arXiv.org:test/0002</identifier>
        <datestamp>2024-01-01</datestamp>
      </header>
      <metadata><dc><dc:title>Page 1</dc:title></dc></metadata>
    </record>
    <resumptionToken expirationDate="2999-01-01T00:00:00Z">live-token</resumptionToken>
  </ListRecords>`).replace(
      '<request verb="Identify">',
      '<request verb="ListRecords" metadataPrefix="oai_dc">'
    );
    const secondPageXml = wrapOaiRoot(`
  <ListRecords>
    <record>
      <header>
        <identifier>oai:arXiv.org:test/0003</identifier>
        <datestamp>2024-01-02</datestamp>
      </header>
      <metadata><dc><dc:title>Page 2</dc:title></dc></metadata>
    </record>
  </ListRecords>`).replace(
      '<request verb="Identify">',
      '<request verb="ListRecords" metadataPrefix="oai_dc">'
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(firstPageXml, { status: 200 }))
      .mockResolvedValueOnce(new Response(secondPageXml, { status: 200 }));

    const records = [];
    for await (const record of oaiListRecordsAsyncIterator('oai_dc', { retries: 0, timeoutMs: 1000 })) {
      records.push(record);
    }

    expect(records).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('preserves previous behavior when expirationDate is omitted', async () => {
    const firstPageXml = wrapOaiRoot(`
  <ListRecords>
    <record>
      <header>
        <identifier>oai:arXiv.org:test/0004</identifier>
        <datestamp>2024-01-01</datestamp>
      </header>
      <metadata><dc><dc:title>Page 1</dc:title></dc></metadata>
    </record>
    <resumptionToken cursor="1">token-no-expiry</resumptionToken>
  </ListRecords>`).replace(
      '<request verb="Identify">',
      '<request verb="ListRecords" metadataPrefix="oai_dc">'
    );
    const secondPageXml = wrapOaiRoot(`
  <ListRecords>
    <record>
      <header>
        <identifier>oai:arXiv.org:test/0005</identifier>
        <datestamp>2024-01-02</datestamp>
      </header>
      <metadata><dc><dc:title>Page 2</dc:title></dc></metadata>
    </record>
  </ListRecords>`).replace(
      '<request verb="Identify">',
      '<request verb="ListRecords" metadataPrefix="oai_dc">'
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(firstPageXml, { status: 200 }))
      .mockResolvedValueOnce(new Response(secondPageXml, { status: 200 }));

    const records = [];
    for await (const record of oaiListRecordsAsyncIterator('oai_dc', { retries: 0, timeoutMs: 1000 })) {
      records.push(record);
    }

    expect(records).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
