/**
 * Client for the arXiv OAI-PMH interface.
 * @see https://info.arxiv.org/help/oa/index.html#open-archives-initiative-oai
 * @see https://www.openarchives.org/OAI/openarchivesprotocol.html
 */

import { TokenBucketLimiter } from './rateLimiter.js';
import { fetchWithRetry } from './http.js';
import {
  type OaiRequestOptions,
  type OaiListOptions,
  type OaiListIdentifiersResult,
  type OaiListRecordsResult,
  type OaiListSetsResult,
} from './oaiTypes.js';
import type { ArxivRateLimitConfig } from './types.js';
import {
  parseIdentify,
  parseListMetadataFormats,
  parseListSets,
  parseGetRecord,
  parseListIdentifiers,
  parseListRecords,
} from './oaiParser.js';
import type {
  OaiIdentifyResponse,
  OaiMetadataFormat,
  OaiRecord,
  OaiHeader,
  OaiSet,
} from './oaiTypes.js';

const OAI_BASE_URL = 'https://oaipmh.arxiv.org/oai';

const DEFAULT_USER_AGENT = 'arxiv-api-wrapper/1.0 (+https://export.arxiv.org)';

type OaiVerb =
  | 'Identify'
  | 'ListMetadataFormats'
  | 'ListSets'
  | 'GetRecord'
  | 'ListIdentifiers'
  | 'ListRecords';

interface OaiParams {
  identifier?: string;
  metadataPrefix?: string;
  from?: string;
  until?: string;
  set?: string;
  resumptionToken?: string;
}

/** Build OAI-PMH request URL (exported for unit tests). */
export function buildOaiUrl(verb: OaiVerb, params: OaiParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set('verb', verb);
  if (params.identifier != null && params.identifier !== '')
    searchParams.set('identifier', params.identifier);
  if (params.metadataPrefix != null && params.metadataPrefix !== '')
    searchParams.set('metadataPrefix', params.metadataPrefix);
  if (params.from != null && params.from !== '') searchParams.set('from', params.from);
  if (params.until != null && params.until !== '') searchParams.set('until', params.until);
  if (params.set != null && params.set !== '') searchParams.set('set', params.set);
  if (params.resumptionToken != null && params.resumptionToken !== '')
    searchParams.set('resumptionToken', params.resumptionToken);
  return `${OAI_BASE_URL}?${searchParams.toString()}`;
}

/**
 * Normalize an arXiv identifier to OAI form (oai:arXiv.org:...).
 * Accepts full form (oai:arXiv.org:cs/0112017) or short form (cs/0112017, 2101.01234).
 */
export function normalizeOaiIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!trimmed) return trimmed;
  if (/^oai:arXiv\.org:/i.test(trimmed)) return trimmed;
  return `oai:arXiv.org:${trimmed}`;
}

function mergeOptions(opts?: OaiRequestOptions): {
  timeoutMs: number;
  retries: number;
  userAgent: string;
  rateLimit?: ArxivRateLimitConfig;
} {
  return {
    timeoutMs: opts?.timeoutMs ?? 10000,
    retries: opts?.retries ?? 3,
    userAgent: opts?.userAgent ?? DEFAULT_USER_AGENT,
    rateLimit: opts?.rateLimit,
  };
}

async function oaiRequest(
  verb: OaiVerb,
  params: OaiParams,
  options: OaiRequestOptions | undefined
): Promise<string> {
  const { timeoutMs, retries, userAgent, rateLimit } = mergeOptions(options);
  const url = buildOaiUrl(verb, params);
  const limiter = rateLimit
    ? new TokenBucketLimiter(rateLimit.tokensPerInterval, rateLimit.intervalMs)
    : undefined;
  if (limiter) await limiter.acquire();
  const res = await fetchWithRetry(
    url,
    { method: 'GET', headers: { Accept: 'text/xml' } },
    { retries, timeoutMs, userAgent }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `OAI request failed: ${res.status} ${res.statusText} for ${verb}. ${text.substring(0, 300)}`
    );
  }
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error(`OAI request returned empty response for ${verb}`);
  }
  return text;
}

/**
 * Retrieve information about the arXiv OAI repository (Identify verb).
 *
 * @param options - Optional request configuration (timeout, retries, userAgent, rateLimit). Same semantics as the Atom API options.
 * @returns Parsed Identify response with repositoryName, baseURL, protocolVersion, etc.
 * @see https://info.arxiv.org/help/oa/index.html#open-archives-initiative-oai
 * @see https://www.openarchives.org/OAI/openarchivesprotocol.html
 */
export async function oaiIdentify(options?: OaiRequestOptions): Promise<OaiIdentifyResponse> {
  const xml = await oaiRequest('Identify', {}, options);
  return parseIdentify(xml);
}

/**
 * List metadata formats supported by the repository, optionally for a specific item (ListMetadataFormats verb).
 *
 * @param identifier - Optional item identifier to list formats for that item only.
 * @param options - Optional request configuration (timeout, retries, userAgent, rateLimit).
 * @returns List of metadata formats (metadataPrefix, schema, metadataNamespace).
 */
export async function oaiListMetadataFormats(
  identifier?: string,
  options?: OaiRequestOptions
): Promise<OaiMetadataFormat[]> {
  const params: OaiParams = {};
  if (identifier != null && identifier !== '') params.identifier = identifier;
  const xml = await oaiRequest('ListMetadataFormats', params, options);
  return parseListMetadataFormats(xml);
}

/**
 * List sets available for selective harvesting (ListSets verb).
 *
 * @param resumptionToken - Optional resumption token from a previous ListSets response.
 * @param options - Optional request configuration (timeout, retries, userAgent, rateLimit).
 * @returns Sets (setSpec, setName, setDescription) and optional resumptionToken.
 */
export async function oaiListSets(
  resumptionToken?: string,
  options?: OaiRequestOptions
): Promise<OaiListSetsResult> {
  const params: OaiParams = {};
  if (resumptionToken != null && resumptionToken !== '') params.resumptionToken = resumptionToken;
  const xml = await oaiRequest('ListSets', params, options);
  return parseListSets(xml);
}

/**
 * Retrieve a single record by identifier and metadata format (GetRecord verb).
 *
 * @param identifier - Item identifier (full form oai:arXiv.org:cs/0112017 or short form cs/0112017, 2101.01234).
 * @param metadataPrefix - Metadata format (e.g. oai_dc, arXiv, arXivRaw).
 * @param options - Optional request configuration (timeout, retries, userAgent, rateLimit).
 * @returns Single OAI record (header + metadata + about).
 */
export async function oaiGetRecord(
  identifier: string,
  metadataPrefix: string,
  options?: OaiRequestOptions
): Promise<OaiRecord> {
  const normalizedId = normalizeOaiIdentifier(identifier);
  const xml = await oaiRequest(
    'GetRecord',
    { identifier: normalizedId, metadataPrefix },
    options
  );
  return parseGetRecord(xml);
}

/**
 * List identifiers (headers only) for selective harvesting (ListIdentifiers verb).
 *
 * @param metadataPrefix - Required metadata format (e.g. oai_dc, arXiv, arXivRaw).
 * @param listOptions - Optional from, until, set, resumptionToken and request options (timeout, retries, userAgent, rateLimit).
 * @returns Headers and optional resumptionToken for the next page.
 */
export async function oaiListIdentifiers(
  metadataPrefix: string,
  listOptions?: OaiListOptions
): Promise<OaiListIdentifiersResult> {
  const params: OaiParams = { metadataPrefix };
  if (listOptions?.resumptionToken != null && listOptions.resumptionToken !== '') {
    params.resumptionToken = listOptions.resumptionToken;
  } else {
    if (listOptions?.from != null && listOptions.from !== '')
      params.from = listOptions.from;
    if (listOptions?.until != null && listOptions.until !== '')
      params.until = listOptions.until;
    if (listOptions?.set != null && listOptions.set !== '') params.set = listOptions.set;
  }
  const xml = await oaiRequest('ListIdentifiers', params, listOptions);
  return parseListIdentifiers(xml);
}

/**
 * List records (full metadata) for selective harvesting (ListRecords verb).
 *
 * @param metadataPrefix - Required metadata format (e.g. oai_dc, arXiv, arXivRaw).
 * @param listOptions - Optional from, until, set, resumptionToken and request options (timeout, retries, userAgent, rateLimit).
 * @returns Records and optional resumptionToken for the next page.
 */
export async function oaiListRecords(
  metadataPrefix: string,
  listOptions?: OaiListOptions
): Promise<OaiListRecordsResult> {
  const params: OaiParams = { metadataPrefix };
  if (listOptions?.resumptionToken != null && listOptions.resumptionToken !== '') {
    params.resumptionToken = listOptions.resumptionToken;
  } else {
    if (listOptions?.from != null && listOptions.from !== '')
      params.from = listOptions.from;
    if (listOptions?.until != null && listOptions.until !== '')
      params.until = listOptions.until;
    if (listOptions?.set != null && listOptions.set !== '') params.set = listOptions.set;
  }
  const xml = await oaiRequest('ListRecords', params, listOptions);
  return parseListRecords(xml);
}

type OaiListRecordsAllOptions = Omit<OaiListOptions, 'resumptionToken'> & {
  maxRecords?: number;
};

type OaiListIdentifiersAllOptions = Omit<OaiListOptions, 'resumptionToken'> & {
  maxHeaders?: number;
};

type OaiListSetsAllOptions = OaiRequestOptions & {
  maxSets?: number;
};

/**
 * Iterate records across all pages for a given metadataPrefix and optional selective harvesting options.
 *
 * This helper follows resumption tokens internally and yields records one-by-one until completion or
 * until the optional maxRecords cap is reached.
 *
 * @param metadataPrefix - Required metadata format (e.g. oai_dc, arXiv, arXivRaw).
 * @param listOptions - Optional from, until, set, request options (timeout, retries, userAgent, rateLimit) and maxRecords.
 *                      Any provided resumptionToken is ignored; pagination is handled internally.
 * @returns Async iterator yielding records one-by-one.
 */
export async function* oaiListRecordsAsyncIterator(
  metadataPrefix: string,
  listOptions?: OaiListRecordsAllOptions
): AsyncGenerator<OaiRecord, void, void> {
  let emitted = 0;
  let resumptionToken: string | undefined;
  const { maxRecords, ...restOptions } = listOptions ?? {};

  do {
    const pageOptions: OaiListOptions = resumptionToken
      ? { ...restOptions, resumptionToken }
      : restOptions;

    const page = await oaiListRecords(metadataPrefix, pageOptions);
    const records = page.records ?? [];
    if (records.length === 0) break;

    for (const record of records) {
      if (maxRecords != null && emitted >= maxRecords) return;
      yield record;
      emitted += 1;
    }

    resumptionToken = page.resumptionToken?.value;
  } while (resumptionToken);
}

/**
 * Iterate identifiers (headers only) across all pages for a given metadataPrefix and optional selective harvesting options.
 *
 * This helper follows resumption tokens internally and yields headers one-by-one until completion or
 * until the optional maxHeaders cap is reached.
 *
 * @param metadataPrefix - Required metadata format (e.g. oai_dc, arXiv, arXivRaw).
 * @param listOptions - Optional from, until, set, request options (timeout, retries, userAgent, rateLimit) and maxHeaders.
 *                      Any provided resumptionToken is ignored; pagination is handled internally.
 * @returns Async iterator yielding headers one-by-one.
 */
export async function* oaiListIdentifiersAsyncIterator(
  metadataPrefix: string,
  listOptions?: OaiListIdentifiersAllOptions
): AsyncGenerator<OaiHeader, void, void> {
  let emitted = 0;
  let resumptionToken: string | undefined;
  const { maxHeaders, ...restOptions } = listOptions ?? {};

  do {
    const pageOptions: OaiListOptions = resumptionToken
      ? { ...restOptions, resumptionToken }
      : restOptions;

    const page = await oaiListIdentifiers(metadataPrefix, pageOptions);
    const headers = page.headers ?? [];
    if (headers.length === 0) break;

    for (const header of headers) {
      if (maxHeaders != null && emitted >= maxHeaders) return;
      yield header;
      emitted += 1;
    }

    resumptionToken = page.resumptionToken?.value;
  } while (resumptionToken);
}

/**
 * Iterate sets available for selective harvesting across all pages.
 *
 * This helper follows resumption tokens internally and yields sets one-by-one until completion or
 * until the optional maxSets cap is reached.
 *
 * @param options - Optional request configuration (timeout, retries, userAgent, rateLimit) and maxSets.
 * @returns Async iterator yielding sets one-by-one.
 */
export async function* oaiListSetsAsyncIterator(
  options?: OaiListSetsAllOptions
): AsyncGenerator<OaiSet, void, void> {
  let emitted = 0;
  let resumptionToken: string | undefined;
  const { maxSets, ...requestOptions } = options ?? {};

  do {
    const page = await oaiListSets(resumptionToken, requestOptions);
    const sets = page.sets ?? [];
    if (sets.length === 0) break;

    for (const set of sets) {
      if (maxSets != null && emitted >= maxSets) return;
      yield set;
      emitted += 1;
    }

    resumptionToken = page.resumptionToken?.value;
  } while (resumptionToken);
}

/**
 * Fetch all records across all pages for a given metadataPrefix and optional selective harvesting options.
 *
 * This helper collects from oaiListRecordsAsyncIterator until completion or the optional maxRecords cap.
 *
 * @param metadataPrefix - Required metadata format (e.g. oai_dc, arXiv, arXivRaw).
 * @param listOptions - Optional from, until, set, request options (timeout, retries, userAgent, rateLimit) and maxRecords.
 *                      Any provided resumptionToken is ignored; pagination is handled internally.
 * @returns All fetched records as a single array.
 */
export async function oaiListRecordsAll(
  metadataPrefix: string,
  listOptions?: OaiListRecordsAllOptions
): Promise<{ records: OaiRecord[] }> {
  const allRecords: OaiRecord[] = [];
  for await (const record of oaiListRecordsAsyncIterator(metadataPrefix, listOptions)) {
    allRecords.push(record);
  }

  return { records: allRecords };
}

/**
 * Fetch all identifiers (headers only) across all pages for a given metadataPrefix and optional selective harvesting options.
 *
 * This helper collects from oaiListIdentifiersAsyncIterator until completion or the optional maxHeaders cap.
 *
 * @param metadataPrefix - Required metadata format (e.g. oai_dc, arXiv, arXivRaw).
 * @param listOptions - Optional from, until, set, request options (timeout, retries, userAgent, rateLimit) and maxHeaders.
 *                      Any provided resumptionToken is ignored; pagination is handled internally.
 * @returns All fetched headers as a single array.
 */
export async function oaiListIdentifiersAll(
  metadataPrefix: string,
  listOptions?: OaiListIdentifiersAllOptions
): Promise<{ headers: OaiHeader[] }> {
  const allHeaders: OaiHeader[] = [];
  for await (const header of oaiListIdentifiersAsyncIterator(metadataPrefix, listOptions)) {
    allHeaders.push(header);
  }

  return { headers: allHeaders };
}

/**
 * Fetch all sets available for selective harvesting across all pages.
 *
 * This helper collects from oaiListSetsAsyncIterator until completion or the optional maxSets cap.
 *
 * @param options - Optional request configuration (timeout, retries, userAgent, rateLimit) and maxSets.
 * @returns All fetched sets as a single array.
 */
export async function oaiListSetsAll(
  options?: OaiListSetsAllOptions
): Promise<{ sets: OaiSet[] }> {
  const allSets: OaiSet[] = [];
  for await (const set of oaiListSetsAsyncIterator(options)) {
    allSets.push(set);
  }

  return { sets: allSets };
}

