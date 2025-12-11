// Basic tests for query building logic using Vitest
import { describe, it, expect } from 'vitest';
import { buildSearchQuery } from '../src/arxivAPIRead';

describe('buildSearchQuery', () => {
  it('ANDs top-level fields', () => {
    const q = buildSearchQuery({ author: ['Ada Lovelace'], title: ['analysis'] });
    expect(q).toMatch(/au:\"Ada Lovelace\"/);
    expect(q).toMatch(/ti:\"analysis\"/);
    expect(q).toMatch(/\+AND\+/);
  });

  it('handles OR subfilters', () => {
    const q = buildSearchQuery({
      author: ['Adrian DelMaestro'],
      or: [{ title: ['checkerboard'] }, { title: ['Pyrochlore'] }],
    });
    expect(q).toMatch(/^au:\"Adrian DelMaestro\"\+AND\+\(ti:\"checkerboard\"\+OR\+ti:\"Pyrochlore\"\)$/);
  });

  it('handles ANDNOT', () => {
    const q = buildSearchQuery({ author: ['Adrian DelMaestro'], andNot: { title: ['checkerboard'] } });
      expect(q).toBe('au:\"Adrian DelMaestro\"+ANDNOT+(ti:\"checkerboard\")');
    });

    it('encodes phrases when phraseExact', () => {
      const q = buildSearchQuery({ title: ['quantum criticality'], phraseExact: true });
    expect(q).toBe('ti:"quantum criticality"');
  });

  it('handles submittedDate range', () => {
    const q = buildSearchQuery({ submittedDateRange: { from: '202301010600', to: '202401010600' } });
    expect(q).toBe('submittedDate:[202301010600+TO+202401010600]');
  });
});

