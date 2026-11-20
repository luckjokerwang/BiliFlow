import { describe, it, expect } from 'vitest';
import { parseDanmakuXml } from '../src/utils/danmakuXml';

function xml(rows: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><i><chatserver>chat.bilibili.com</chatserver>${rows}</i>`;
}

describe('parseDanmakuXml', () => {
  it('decodes XML entities and keeps valid rows', () => {
    const input = xml(
      '<d p="10.5,1,25,0,0,0,12345,abc">Hello &lt;world&gt; &amp; &quot;friends&quot;</d>'
    );
    expect(parseDanmakuXml(input, 100)).toEqual([
      { id: 'abc', timestampSec: 10.5, content: 'Hello <world> & "friends"' },
    ]);
  });

  it('decodes numeric entities', () => {
    const input = xml('<d p="1,1,25,0,0,0,1,x">&#20320;&#x597D;</d>');
    expect(parseDanmakuXml(input, 0)[0].content).toBe('你好');
  });

  it('filters by pool, mode, length and time bounds', () => {
    const input = xml(
      [
        '<d p="5,1,25,0,0,1,1,a">wrong pool</d>',
        '<d p="5,4,25,0,0,0,2,b">wrong mode</d>',
        '<d p="5,1,25,0,0,0,3,c">x</d>',
        '<d p="200,1,25,0,0,0,4,d">out of range</d>',
        '<d p="-1,1,25,0,0,0,5,e">negative</d>',
        '<d p="6,2,25,0,0,0,6,f">valid row</d>',
      ].join('')
    );
    expect(parseDanmakuXml(input, 100).map((item) => item.id)).toEqual(['f']);
  });

  it('skips malformed rows and returns empty for no <d>', () => {
    expect(parseDanmakuXml(xml('<d p="bad,1">oops</d>'), 100)).toEqual([]);
    expect(parseDanmakuXml(xml(''), 100)).toEqual([]);
    expect(parseDanmakuXml('', 100)).toEqual([]);
  });

  it('does not apply an upper bound when duration is zero', () => {
    const input = xml('<d p="5000,1,25,0,0,0,1,a">far future</d>');
    expect(parseDanmakuXml(input, 0)).toHaveLength(1);
  });
});
