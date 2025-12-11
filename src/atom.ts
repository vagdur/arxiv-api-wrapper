import { ArxivEntry, ArxivFeedMeta, ArxivLink } from './types';
import { XMLParser } from 'fast-xml-parser';

// XML parser configured to keep attributes and drop namespace prefixes
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: true,
});

function extractArxivId(absUrl: string | undefined): string {
  if (!absUrl) return '';
  const cleaned = absUrl.split('#')[0].split('?')[0];
  const idx = cleaned.lastIndexOf('/');
  const last = idx >= 0 ? cleaned.slice(idx + 1) : cleaned;
  return last.replace(/^arXiv:/i, '');
}

function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

export function parseFeedMeta(xml: string): ArxivFeedMeta {
  const doc = parser.parse(xml) as any;
  const feed = doc.feed || {};

  const title: string = feed.title ?? '';
  const id: string = feed.id ?? '';
  const updated: string = feed.updated ?? '';

  const linksArr: any[] = Array.isArray(feed.link) ? feed.link : (feed.link ? [feed.link] : []);
  const selfLink = linksArr.find((l) => l.rel === 'self')?.href;
  const feedLink: string = selfLink || linksArr[0]?.href || '';

  const totalResultsRaw = feed.totalResults ?? feed['opensearch:totalResults'] ?? '0';
  const startIndexRaw = feed.startIndex ?? feed['opensearch:startIndex'] ?? '0';
  const itemsPerPageRaw = feed.itemsPerPage ?? feed['opensearch:itemsPerPage'] ?? '0';

  const totalResults = parseInt(String(totalResultsRaw), 10) || 0;
  const startIndex = parseInt(String(startIndexRaw), 10) || 0;
  const itemsPerPage = parseInt(String(itemsPerPageRaw), 10) || 0;

  return { id, updated, title, link: feedLink, totalResults, startIndex, itemsPerPage };
}

export function parseEntries(xml: string): ArxivEntry[] {
  const doc = parser.parse(xml) as any;
  const feed = doc.feed || {};
  const rawEntries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : []);

  const entries: ArxivEntry[] = rawEntries.map((e: any) => {
    const idUrl: string = e.id || '';
    const published: string = e.published || '';
    const updated: string = e.updated || '';
    const title: string = normalizeWhitespace(e.title || '');
    const summary: string = normalizeWhitespace(e.summary || '');

    const authorBlocks = Array.isArray(e.author) ? e.author : (e.author ? [e.author] : []);
    const authors: { name: string; affiliation?: string }[] = authorBlocks.map((ab: any) => {
      const affiliation = ab.affiliation || ab['arxiv:affiliation'];
      return {
        name: ab.name || '',
        ...(affiliation ? { affiliation } : {}),
      };
    });

    const categoriesArr = Array.isArray(e.category) ? e.category : (e.category ? [e.category] : []);
    const categories = categoriesArr.map((c: any) => c.term).filter(Boolean) as string[];
    const primaryCategoryObj = e.primary_category || e['arxiv:primary_category'];
    const primaryCategory: string | undefined = primaryCategoryObj?.term;

    const linksArr = Array.isArray(e.link) ? e.link : (e.link ? [e.link] : []);
    const links: ArxivLink[] = linksArr
      .map((l: any) => {
        const link: ArxivLink = {
          href: l.href,
          ...(l.rel ? { rel: l.rel } : {}),
          ...(l.type ? { type: l.type } : {}),
          ...(l.title ? { title: l.title } : {}),
        };
        return link;
      })
      .filter((l: ArxivLink) => !!l.href);

    const doi: string | undefined = e.doi || e['arxiv:doi'];
    const journalRef: string | undefined = e.journal_ref || e['arxiv:journal_ref'];
    const comment: string | undefined = normalizeWhitespace(e.comment || e['arxiv:comment'] || '');

    const absHref =
      links.find((l) => (l.rel === 'alternate' || !l.rel) && l.href?.includes('/abs/'))?.href
      || links.find((l) => l.href?.includes('/abs/'))?.href;

    const chosenId = idUrl || absHref || '';

    return {
      id: chosenId,
      arxivId: extractArxivId(chosenId),
      title,
      summary,
      published,
      updated,
      authors,
      categories,
      ...(primaryCategory ? { primaryCategory } : {}),
      links,
      ...(doi ? { doi } : {}),
      ...(journalRef ? { journalRef } : {}),
      ...(comment ? { comment } : {}),
    } as ArxivEntry;
  });

  return entries;
}

