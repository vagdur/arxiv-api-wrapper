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
  metadataPrefix: OaiMetadataPrefix;
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

/** arXiv OAI metadata prefixes supported by the repository. */
export type OaiMetadataPrefix = 'oai_dc' | 'arXiv' | 'arXivOld' | 'arXivRaw';

type OneOrMany<T> = T | T[];

/** oai_dc metadata (Dublin Core). */
export interface OaiDcMetadata {
  dc: {
    title?: OneOrMany<string>;
    creator?: OneOrMany<string>;
    subject?: OneOrMany<string>;
    description?: OneOrMany<string>;
    publisher?: OneOrMany<string>;
    contributor?: OneOrMany<string>;
    date?: OneOrMany<string>;
    type?: OneOrMany<string>;
    format?: OneOrMany<string>;
    identifier?: OneOrMany<string>;
    source?: OneOrMany<string>;
    language?: OneOrMany<string>;
    relation?: OneOrMany<string>;
    coverage?: OneOrMany<string>;
    rights?: OneOrMany<string>;
  };
}

/** arXiv author in the arXiv metadata format. */
export interface OaiArxivAuthor {
  keyname: string;
  forenames?: string;
  suffix?: string;
  affiliation?: OneOrMany<string>;
}

/** arXiv metadata (latest-version focused metadata). */
export interface OaiArxivMetadata {
  arXiv: {
    id: string;
    created?: string;
    updated?: string;
    authors?: {
      author: OneOrMany<OaiArxivAuthor>;
    };
    title?: string;
    'msc-class'?: string;
    'acm-class'?: string;
    'report-no'?: string;
    'journal-ref'?: string;
    comments?: string;
    abstract?: string;
    categories?: string;
    doi?: string;
    proxy?: string;
    license?: string;
  };
}

/** arXivOld metadata (legacy arXiv internal format). */
export interface OaiArxivOldMetadata {
  arXivOld: {
    id: string;
    title?: string;
    authors?: string;
    categories?: string;
    comments?: string;
    proxy?: string;
    'report-no'?: string;
    'msc-class'?: string;
    'acm-class'?: string;
    'journal-ref'?: string;
    doi?: string;
    abstract?: string;
    license?: string;
  };
}

/** Version entry in arXivRaw metadata. */
export interface OaiArxivRawVersion {
  version?: string;
  date: string;
  size?: string;
  source_type?: string;
}

/** arXivRaw metadata (close to arXiv internal metadata with version history). */
export interface OaiArxivRawMetadata {
  arXivRaw: {
    id: string;
    submitter: string;
    version: OneOrMany<OaiArxivRawVersion>;
    title?: string;
    authors?: string;
    categories: string;
    comments?: string;
    proxy?: string;
    'report-no'?: string;
    'acm-class'?: string;
    'msc-class'?: string;
    'journal-ref'?: string;
    doi?: string;
    license?: string;
    abstract?: string;
  };
}

/** Mapping from metadataPrefix to metadata payload shape. */
export interface OaiMetadataByPrefix {
  oai_dc: OaiDcMetadata;
  arXiv: OaiArxivMetadata;
  arXivOld: OaiArxivOldMetadata;
  arXivRaw: OaiArxivRawMetadata;
}

/** Metadata part of a record (format-dependent: oai_dc, arXiv, arXivOld, arXivRaw). */
export type OaiMetadata = OaiMetadataByPrefix[keyof OaiMetadataByPrefix];

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

type OaiSelectiveHarvestOptions = {
  /** Lower bound for datestamp-based selective harvesting (UTC). */
  from?: string;
  /** Upper bound for datestamp-based selective harvesting (UTC). */
  until?: string;
  /** Set spec for selective harvesting (e.g. cs:cs:AI, physics:hep-th). */
  set?: string;
  /** Resumption token must not be provided for an initial selective request. */
  resumptionToken?: undefined;
};

type OaiResumptionTokenOnlyOptions = {
  /** Resumption token from a previous incomplete list response. */
  resumptionToken: string;
  /** Selective harvesting parameters are not allowed together with resumptionToken. */
  from?: never;
  until?: never;
  set?: never;
};

/** Options for ListIdentifiers and ListRecords. */
export type OaiListOptions = OaiRequestOptions &
  (OaiSelectiveHarvestOptions | OaiResumptionTokenOnlyOptions);

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
