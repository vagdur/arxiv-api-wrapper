/**
 * Parser for OAI-PMH XML responses from the arXiv OAI endpoint.
 */

import {
  type OaiErrorCode,
  type OaiIdentifyResponse,
  type OaiMetadataFormat,
  type OaiMetadataPrefix,
  type OaiSet,
  type OaiResumptionToken,
  type OaiHeader,
  type OaiRecord,
  type OaiMetadata,
  OaiError,
} from './oaiTypes.js';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

const VALID_ERROR_CODES: OaiErrorCode[] = [
  'badArgument',
  'badResumptionToken',
  'badVerb',
  'cannotDisseminateFormat',
  'idDoesNotExist',
  'noMetadataFormats',
  'noRecordsMatch',
  'noSetHierarchy',
];

const VALID_METADATA_PREFIXES: OaiMetadataPrefix[] = ['oai_dc', 'arXiv', 'arXivOld', 'arXivRaw'];

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function parseErrors(root: Record<string, unknown>): OaiError[] {
  const errors: OaiError[] = [];
  const raw = root.error;
  if (raw == null) return errors;
  const arr = asArray(raw);
  for (const e of arr) {
    const code = (e && typeof e === 'object' && 'code' in e && e.code) as string | undefined;
    const msg = (e && typeof e === 'object' && '#text' in e ? e['#text'] : e) as string | unknown;
    const messageText = typeof msg === 'string' ? msg : typeof msg !== 'undefined' ? String(msg) : '';
    const codeStr = (code ?? 'badArgument') as OaiErrorCode;
    if (VALID_ERROR_CODES.includes(codeStr)) {
      errors.push(new OaiError(codeStr, messageText));
    } else {
      errors.push(new OaiError('badArgument', messageText || codeStr));
    }
  }
  return errors;
}

function parseResumptionToken(el: unknown): OaiResumptionToken | undefined {
  if (el == null || typeof el !== 'object') return undefined;
  const o = el as Record<string, unknown>;
  const value = str(o['#text'] ?? o['_'] ?? '');
  if (!value) return undefined;
  const token: OaiResumptionToken = { value };
  if (o.expirationDate != null) token.expirationDate = str(o.expirationDate);
  if (o.completeListSize != null) token.completeListSize = Number(o.completeListSize);
  if (o.cursor != null) token.cursor = Number(o.cursor);
  return token;
}

function parseHeader(el: unknown): OaiHeader {
  const o = (el != null && typeof el === 'object' ? el : {}) as Record<string, unknown>;
  const setSpec = asArray(o.setSpec).map((s) => str(s));
  const status = o.status != null ? str(o.status) : undefined;
  return {
    identifier: str(o.identifier),
    datestamp: str(o.datestamp),
    setSpec,
    ...(status === 'deleted' ? { status: 'deleted' as const } : {}),
  };
}

/** Extract metadata as a plain object (first child of metadata is format-specific, e.g. dc or arXiv). */
function parseMetadata(el: unknown): OaiMetadata | undefined {
  if (el == null || typeof el !== 'object') return undefined;
  const o = el as Record<string, unknown>;
  // metadata has a single child (e.g. dc, arXiv) - flatten one level for convenience
  const keys = Object.keys(o).filter((k) => !k.startsWith('@') && k !== '#text' && k !== '_');
  if (keys.length === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const val = o[key];
    if (val != null && typeof val === 'object' && !Array.isArray(val)) {
      out[key] = val;
    } else {
      out[key] = val;
    }
  }
  return out as unknown as OaiMetadata;
}

function parseRecord(el: unknown): OaiRecord {
  const o = (el != null && typeof el === 'object' ? el : {}) as Record<string, unknown>;
  const header = parseHeader(o.header);
  const metadata = o.metadata != null ? parseMetadata(o.metadata) : undefined;
  const about = o.about != null ? asArray(o.about) : undefined;
  return { header, ...(metadata != null ? { metadata } : {}), ...(about != null ? { about } : {}) };
}

function getRoot(xml: string): Record<string, unknown> {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = doc['OAI-PMH'] ?? doc['OAIPMH'] ?? doc;
  if (root == null || typeof root !== 'object') {
    throw new OaiError('badArgument', 'Invalid OAI-PMH response: no root element');
  }
  return root as Record<string, unknown>;
}

/**
 * Parse OAI-PMH response and throw OaiError if the response contains error elements.
 * Returns the verb-specific payload (e.g. Identify, ListRecords).
 */
export function parseOaiResponse(xml: string): Record<string, unknown> {
  const root = getRoot(xml);
  const errors = parseErrors(root);
  if (errors.length > 0) {
    const first = errors[0];
    throw first;
  }
  return root;
}

/**
 * Parse an Identify response body.
 */
export function parseIdentify(xml: string): OaiIdentifyResponse {
  const root = parseOaiResponse(xml);
  const id = (root.Identify ?? root.identify) as Record<string, unknown> | undefined;
  if (!id || typeof id !== 'object') {
    throw new OaiError('badArgument', 'Invalid Identify response: missing Identify element');
  }
  return {
    repositoryName: str(id.repositoryName),
    baseURL: str(id.baseURL),
    protocolVersion: str(id.protocolVersion),
    adminEmail: asArray(id.adminEmail).map((e) => str(e)),
    earliestDatestamp: str(id.earliestDatestamp),
    deletedRecord: (str(id.deletedRecord) || 'no') as 'no' | 'persistent' | 'transient',
    granularity: (str(id.granularity) || 'YYYY-MM-DD') as 'YYYY-MM-DD' | 'YYYY-MM-DDThh:mm:ssZ',
    compression: asArray(id.compression).map((c) => str(c)).filter(Boolean),
    description: id.description != null ? asArray(id.description) : undefined,
  };
}

/**
 * Parse a ListMetadataFormats response body.
 */
export function parseListMetadataFormats(xml: string): OaiMetadataFormat[] {
  const root = parseOaiResponse(xml);
  const list = root.ListMetadataFormats ?? root.listMetadataFormats;
  if (!list || typeof list !== 'object') {
    throw new OaiError('badArgument', 'Invalid ListMetadataFormats response');
  }
  const arr = (list as Record<string, unknown>).metadataFormat;
  const formats = asArray(arr);
  return formats.map((f: unknown) => {
    const o = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
    const metadataPrefix = str(o.metadataPrefix);
    if (!VALID_METADATA_PREFIXES.includes(metadataPrefix as OaiMetadataPrefix)) {
      throw new OaiError(
        'cannotDisseminateFormat',
        `Unsupported metadataPrefix in ListMetadataFormats response: ${metadataPrefix}`
      );
    }
    return {
      metadataPrefix: metadataPrefix as OaiMetadataPrefix,
      schema: str(o.schema),
      metadataNamespace: str(o.metadataNamespace),
    };
  });
}

/**
 * Parse a ListSets response body.
 */
export function parseListSets(xml: string): { sets: OaiSet[]; resumptionToken?: OaiResumptionToken } {
  const root = parseOaiResponse(xml);
  const list = root.ListSets ?? root.listSets;
  if (!list || typeof list !== 'object') {
    throw new OaiError('badArgument', 'Invalid ListSets response');
  }
  const o = list as Record<string, unknown>;
  const setArr = asArray(o.set);
  const sets: OaiSet[] = setArr.map((s: unknown) => {
    const set = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    return {
      setSpec: str(set.setSpec),
      setName: str(set.setName),
      ...(set.setDescription != null ? { setDescription: set.setDescription } : {}),
    };
  });
  const resumptionToken = parseResumptionToken(o.resumptionToken);
  return { sets, ...(resumptionToken ? { resumptionToken } : {}) };
}

/**
 * Parse a GetRecord response body.
 */
export function parseGetRecord(xml: string): OaiRecord {
  const root = parseOaiResponse(xml);
  const getRecord = root.GetRecord ?? root.getRecord;
  if (!getRecord || typeof getRecord !== 'object') {
    throw new OaiError('badArgument', 'Invalid GetRecord response');
  }
  const record = (getRecord as Record<string, unknown>).record;
  if (!record) throw new OaiError('badArgument', 'Invalid GetRecord response: missing record');
  return parseRecord(record);
}

/**
 * Parse a ListIdentifiers response body.
 */
export function parseListIdentifiers(
  xml: string
): { headers: OaiHeader[]; resumptionToken?: OaiResumptionToken } {
  const root = parseOaiResponse(xml);
  const list = root.ListIdentifiers ?? root.listIdentifiers;
  if (!list || typeof list !== 'object') {
    throw new OaiError('badArgument', 'Invalid ListIdentifiers response');
  }
  const o = list as Record<string, unknown>;
  const headerArr = asArray(o.header);
  const headers = headerArr.map((h: unknown) => parseHeader(h));
  const resumptionToken = parseResumptionToken(o.resumptionToken);
  return { headers, ...(resumptionToken ? { resumptionToken } : {}) };
}

/**
 * Parse a ListRecords response body.
 */
export function parseListRecords(
  xml: string
): { records: OaiRecord[]; resumptionToken?: OaiResumptionToken } {
  const root = parseOaiResponse(xml);
  const list = root.ListRecords ?? root.listRecords;
  if (!list || typeof list !== 'object') {
    throw new OaiError('badArgument', 'Invalid ListRecords response');
  }
  const o = list as Record<string, unknown>;
  const recordArr = asArray(o.record);
  const records = recordArr.map((r: unknown) => parseRecord(r));
  const resumptionToken = parseResumptionToken(o.resumptionToken);
  return { records, ...(resumptionToken ? { resumptionToken } : {}) };
}
