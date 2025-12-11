import { describe, it, expect } from 'vitest';
import { parseEntries } from '../src/atom.js';
import { xmlString as xml2507_17541 } from './fixtures/parseEntries/2507.17541.xml.js';
import { expectedEntries as expected2507_17541 } from './fixtures/parseEntries/2507.17541.json.js';
import { xmlString as xmlSearchAgdur } from './fixtures/parseEntries/search_agdur.xml.js';
import { expectedEntries as expectedSearchAgdur } from './fixtures/parseEntries/search_agdur.json.js';

describe('parseEntries', () => {
  it('should correctly parse 2507.17541', () => {
    const result = parseEntries(xml2507_17541);
    expect(result).toEqual(expected2507_17541);
  });

  it('should correctly parse search_agdur', () => {
    const result = parseEntries(xmlSearchAgdur);
    expect(result).toEqual(expectedSearchAgdur);
  });
});

