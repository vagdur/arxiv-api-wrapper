/**
 * OAI-PMH types for the arXiv OAI interface.
 * @see https://info.arxiv.org/help/oa/index.html#open-archives-initiative-oai
 * @see https://www.openarchives.org/OAI/openarchivesprotocol.html
 */

import type { ArxivRateLimitConfig } from './types.js';

/** OAI-PMH error codes. */
export type OaiErrorCode =
  | 'badArgument'
  | 'badResumptionToken'
  | 'badVerb'
  | 'cannotDisseminateFormat'
  | 'idDoesNotExist'
  | 'noMetadataFormats'
  | 'noRecordsMatch'
  | 'noSetHierarchy';

/** Options shared by all OAI request functions. */
export interface OaiRequestOptions {
  /** Request timeout in milliseconds (default: 10000). */
  timeoutMs?: number;
  /** Number of retry attempts for failed requests (default: 3). */
  retries?: number;
  /** Custom User-Agent header for requests. */
  userAgent?: string;
  /** Rate limiting configuration. */
  rateLimit?: ArxivRateLimitConfig;
}

/** Response to the Identify verb. */
export interface OaiIdentifyResponse {
  repositoryName: string;
  baseURL: string;
  protocolVersion: string;
  adminEmail: string[];
  earliestDatestamp: string;
  deletedRecord: 'no' | 'persistent' | 'transient';
  granularity: 'YYYY-MM-DD' | 'YYYY-MM-DDThh:mm:ssZ';
  compression?: string[];
  description?: unknown[];
}

/** A metadata format from ListMetadataFormats. */
export interface OaiMetadataFormat {
  metadataPrefix: string;
  schema: string;
  metadataNamespace: string;
}

/** A set from ListSets (for selective harvesting). */
export interface OaiSet {
  setSpec: string;
  setName: string;
  setDescription?: unknown;
}

/** Resumption token for paginated list responses. */
export interface OaiResumptionToken {
  /** Opaque token value to pass to the next request. */
  value: string;
  /** When the token expires (UTC). */
  expirationDate?: string;
  /** Total size of the complete list (may be approximate). */
  completeListSize?: number;
  /** Cursor position (number of elements returned so far). */
  cursor?: number;
}

/** Record header (identifier, datestamp, setSpecs, optional deleted status). */
export interface OaiHeader {
  identifier: string;
  datestamp: string;
  setSpec: string[];
  /** Present and 'deleted' when the record has been withdrawn. */
  status?: 'deleted';
}

/** Metadata part of a record (format-dependent: oai_dc, arXiv, arXivRaw). */
export type OaiMetadata = Record<string, unknown>;

/** A single OAI record (header + optional metadata and about). */
export interface OaiRecord {
  header: OaiHeader;
  /** Omitted for deleted records. */
  metadata?: OaiMetadata;
  /** Optional about containers (e.g. provenance, rights). */
  about?: unknown[];
}

/** Result of ListIdentifiers (headers + optional resumption). */
export interface OaiListIdentifiersResult {
  headers: OaiHeader[];
  resumptionToken?: OaiResumptionToken;
}

/** Result of ListRecords (records + optional resumption). */
export interface OaiListRecordsResult {
  records: OaiRecord[];
  resumptionToken?: OaiResumptionToken;
}

/** Result of ListSets (sets + optional resumption). */
export interface OaiListSetsResult {
  sets: OaiSet[];
  resumptionToken?: OaiResumptionToken;
}

/** Options for ListIdentifiers and ListRecords. */
export interface OaiListOptions extends OaiRequestOptions {
  /** Lower bound for datestamp-based selective harvesting (UTC). */
  from?: string;
  /** Upper bound for datestamp-based selective harvesting (UTC). */
  until?: string;
  /** Set spec for selective harvesting (e.g. cs:cs:AI, physics:hep-th). */
  set?: string;
  /** Resumption token from a previous incomplete list response. */
  resumptionToken?: string;
}

/** Error thrown when the OAI repository returns an error element. */
export class OaiError extends Error {
  readonly code: OaiErrorCode;
  readonly messageText: string;

  constructor(code: OaiErrorCode, messageText: string = '') {
    const msg = messageText ? `${code}: ${messageText}` : code;
    super(msg);
    this.name = 'OaiError';
    this.code = code;
    this.messageText = messageText;
    Object.setPrototypeOf(this, OaiError.prototype);
  }
}
