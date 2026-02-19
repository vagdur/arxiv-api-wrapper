import type { ArxivAuthor, ArxivEntry, ArxivLink, ArxivQueryResult } from './types.js';
import type { OaiListRecordsResult, OaiMetadata, OaiRecord } from './oaiTypes.js';

const OAI_BASE_URL = 'https://oaipmh.arxiv.org/oai';
const ARXIV_ABS_BASE = 'https://arxiv.org/abs/';
const ARXIV_PDF_BASE = 'https://arxiv.org/pdf/';

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function firstNonEmpty(values: string[]): string {
  return values.map((v) => normalizeWhitespace(v)).find(Boolean) ?? '';
}

function toStringArray(value: string | string[] | undefined): string[] {
  return asArray(value).map((v) => normalizeWhitespace(String(v))).filter(Boolean);
}

function oaiIdentifierToArxivId(identifier: string): string {
  return identifier.replace(/^oai:arXiv\.org:/i, '').trim();
}

function buildDefaultLinks(arxivId: string): ArxivLink[] {
  if (!arxivId) return [];
  return [
    { href: `${ARXIV_ABS_BASE}${arxivId}`, rel: 'alternate', type: 'text/html' },
    { href: `${ARXIV_PDF_BASE}${arxivId}`, rel: 'related', type: 'application/pdf', title: 'pdf' },
  ];
}

function splitCategories(value: string | undefined): string[] {
  if (!value) return [];
  return value.trim().split(/\s+/).filter(Boolean);
}

function parseAuthorsList(value: string | undefined): ArxivAuthor[] {
  if (!value) return [];
  return value
    .split(/\s*,\s*/)
    .map((name) => normalizeWhitespace(name))
    .filter(Boolean)
    .map((name) => ({ name }));
}

function withVersionSuffix(baseId: string, version: string | undefined): string {
  if (!version) return baseId;
  if (/v\d+$/i.test(baseId)) return baseId;
  return `${baseId}${version}`;
}

function extractLatestRawVersion(
  versionValue: { version?: string; date: string; size?: string; source_type?: string } | { version?: string; date: string; size?: string; source_type?: string }[]
): { version?: string; date: string; size?: string; source_type?: string } {
  const versions = asArray(versionValue);
  if (versions.length === 0) return { date: '' };
  const sorted = [...versions].sort((a, b) => {
    const va = Number((a.version ?? '').replace(/^v/i, ''));
    const vb = Number((b.version ?? '').replace(/^v/i, ''));
    if (Number.isNaN(va) || Number.isNaN(vb)) return 0;
    return va - vb;
  });
  return sorted[sorted.length - 1];
}

function metadataToEntry(record: OaiRecord, metadata: OaiMetadata): ArxivEntry {
  const fallbackArxivId = oaiIdentifierToArxivId(record.header.identifier);
  const fallbackUpdated = record.header.datestamp;

  if ('arXiv' in metadata) {
    const rawAuthors = asArray(metadata.arXiv.authors?.author);
    const authors: ArxivAuthor[] = rawAuthors.map((a) => {
      const name = [a.forenames, a.keyname, a.suffix].filter(Boolean).join(' ').trim();
      const affiliations = toStringArray(a.affiliation);
      return { name: name || a.keyname, ...(affiliations[0] ? { affiliation: affiliations[0] } : {}) };
    });
    const arxivId = metadata.arXiv.id || fallbackArxivId;
    const categories = splitCategories(metadata.arXiv.categories);
    return {
      id: `${ARXIV_ABS_BASE}${arxivId}`,
      arxivId,
      title: normalizeWhitespace(metadata.arXiv.title ?? ''),
      summary: normalizeWhitespace(metadata.arXiv.abstract ?? ''),
      published: metadata.arXiv.created ?? fallbackUpdated,
      updated: metadata.arXiv.updated ?? fallbackUpdated,
      authors,
      categories,
      ...(categories[0] ? { primaryCategory: categories[0] } : {}),
      links: buildDefaultLinks(arxivId),
      ...(metadata.arXiv.doi ? { doi: metadata.arXiv.doi } : {}),
      ...(metadata.arXiv['journal-ref'] ? { journalRef: metadata.arXiv['journal-ref'] } : {}),
      ...(metadata.arXiv.comments ? { comment: normalizeWhitespace(metadata.arXiv.comments) } : {}),
    };
  }

  if ('arXivRaw' in metadata) {
    const latestVersion = extractLatestRawVersion(metadata.arXivRaw.version);
    const arxivId = withVersionSuffix(metadata.arXivRaw.id || fallbackArxivId, latestVersion.version);
    const categories = splitCategories(metadata.arXivRaw.categories);
    return {
      id: `${ARXIV_ABS_BASE}${arxivId}`,
      arxivId,
      title: normalizeWhitespace(metadata.arXivRaw.title ?? ''),
      summary: normalizeWhitespace(metadata.arXivRaw.abstract ?? ''),
      published: asArray(metadata.arXivRaw.version)[0]?.date ?? fallbackUpdated,
      updated: latestVersion.date || fallbackUpdated,
      authors: parseAuthorsList(metadata.arXivRaw.authors),
      categories,
      ...(categories[0] ? { primaryCategory: categories[0] } : {}),
      links: buildDefaultLinks(arxivId),
      ...(metadata.arXivRaw.doi ? { doi: metadata.arXivRaw.doi } : {}),
      ...(metadata.arXivRaw['journal-ref'] ? { journalRef: metadata.arXivRaw['journal-ref'] } : {}),
      ...(metadata.arXivRaw.comments ? { comment: normalizeWhitespace(metadata.arXivRaw.comments) } : {}),
    };
  }

  if ('arXivOld' in metadata) {
    const arxivId = metadata.arXivOld.id || fallbackArxivId;
    const categories = splitCategories(metadata.arXivOld.categories);
    return {
      id: `${ARXIV_ABS_BASE}${arxivId}`,
      arxivId,
      title: normalizeWhitespace(metadata.arXivOld.title ?? ''),
      summary: normalizeWhitespace(metadata.arXivOld.abstract ?? ''),
      published: fallbackUpdated,
      updated: fallbackUpdated,
      authors: parseAuthorsList(metadata.arXivOld.authors),
      categories,
      ...(categories[0] ? { primaryCategory: categories[0] } : {}),
      links: buildDefaultLinks(arxivId),
      ...(metadata.arXivOld.doi ? { doi: metadata.arXivOld.doi } : {}),
      ...(metadata.arXivOld['journal-ref'] ? { journalRef: metadata.arXivOld['journal-ref'] } : {}),
      ...(metadata.arXivOld.comments ? { comment: normalizeWhitespace(metadata.arXivOld.comments) } : {}),
    };
  }

  const dc = metadata.dc;
  const identifierValues = toStringArray(dc.identifier);
  const identifierFromDc = firstNonEmpty(identifierValues);
  const arxivIdFromDc =
    oaiIdentifierToArxivId(identifierFromDc).replace(/^https?:\/\/arxiv\.org\/abs\//i, '') ||
    fallbackArxivId;
  const creators = toStringArray(dc.creator);
  const categories = toStringArray(dc.subject);
  const published = firstNonEmpty(toStringArray(dc.date)) || fallbackUpdated;
  const summary = firstNonEmpty(toStringArray(dc.description));
  const title = firstNonEmpty(toStringArray(dc.title));

  return {
    id: `${ARXIV_ABS_BASE}${arxivIdFromDc}`,
    arxivId: arxivIdFromDc,
    title,
    summary,
    published,
    updated: fallbackUpdated,
    authors: creators.map((name) => ({ name })),
    categories,
    ...(categories[0] ? { primaryCategory: categories[0] } : {}),
    links: buildDefaultLinks(arxivIdFromDc),
  };
}

/**
 * Convert one OAI record to the package's ArxivEntry shape.
 * Returns null for deleted records or records that do not include metadata.
 */
export function oaiRecordToArxivEntry(record: OaiRecord): ArxivEntry | null {
  if (record.header.status === 'deleted' || record.metadata == null) return null;
  return metadataToEntry(record, record.metadata);
}

/** Convert OAI records to ArxivEntry array, skipping deleted/metadata-less records. */
export function oaiRecordsToArxivEntries(records: OaiRecord[]): ArxivEntry[] {
  return records
    .map((record) => oaiRecordToArxivEntry(record))
    .filter((entry): entry is ArxivEntry => entry != null);
}

/**
 * Convert an OAI ListRecords result to the same shape returned by getArxivEntries().
 * Feed values are synthesized from OAI response data.
 */
export function oaiListRecordsToArxivQueryResult(result: OaiListRecordsResult): ArxivQueryResult {
  const entries = oaiRecordsToArxivEntries(result.records);
  const latestUpdated = entries.map((e) => e.updated).sort().at(-1) ?? '';
  const startIndex = Math.max(0, (result.resumptionToken?.cursor ?? entries.length) - entries.length);
  return {
    feed: {
      id: OAI_BASE_URL,
      updated: latestUpdated,
      title: 'arXiv OAI converted records',
      link: OAI_BASE_URL,
      totalResults: result.resumptionToken?.completeListSize ?? entries.length,
      startIndex,
      itemsPerPage: entries.length,
    },
    entries,
  };
}
