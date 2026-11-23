import type { VideoCategoryInfo, VideoCategoryKey } from '../types';


interface VideoCategoryDefinition {
  key: VideoCategoryKey;
  label: string;
  tidV2: number;
  v1Tid?: number;
  childRange?: readonly [number, number];
}

/**
 * v2 roots and their contiguous child ranges from the public Bilibili zone table.
 * v1-only roots keep tidV2=0 and are reachable through the legacy tid fallback.
 */
const CATEGORY_DEFINITIONS: readonly VideoCategoryDefinition[] = [
  { key: 'cinephile', label: '影视', tidV2: 1001, v1Tid: 181, childRange: [2001, 2008] },
  { key: 'entertainment', label: '娱乐', tidV2: 1002, v1Tid: 5, childRange: [2009, 2015] },
  { key: 'music', label: '音乐', tidV2: 1003, v1Tid: 3, childRange: [2016, 2027] },
  { key: 'dance', label: '舞蹈', tidV2: 1004, v1Tid: 129, childRange: [2028, 2036] },
  { key: 'douga', label: '动画', tidV2: 1005, v1Tid: 1, childRange: [2037, 2054] },
  { key: 'painting', label: '绘画', tidV2: 1006, childRange: [2055, 2058] },
  { key: 'kichiku', label: '鬼畜', tidV2: 1007, v1Tid: 119, childRange: [2059, 2063] },
  { key: 'game', label: '游戏', tidV2: 1008, v1Tid: 4, childRange: [2064, 2079] },
  { key: 'information', label: '资讯', tidV2: 1009, v1Tid: 202, childRange: [2080, 2083] },
  { key: 'knowledge', label: '知识', tidV2: 1010, v1Tid: 36, childRange: [2084, 2095] },
  { key: 'ai', label: '人工智能', tidV2: 1011, childRange: [2096, 2098] },
  { key: 'tech', label: '科技数码', tidV2: 1012, v1Tid: 188, childRange: [2099, 2105] },
  { key: 'car', label: '汽车', tidV2: 1013, v1Tid: 223, childRange: [2106, 2110] },
  { key: 'fashion', label: '时尚美妆', tidV2: 1014, v1Tid: 155, childRange: [2111, 2119] },
  { key: 'home', label: '家装房产', tidV2: 1015, childRange: [2120, 2123] },
  { key: 'outdoors', label: '户外潮流', tidV2: 1016, childRange: [2124, 2127] },
  { key: 'gym', label: '健身', tidV2: 1017, childRange: [2128, 2132] },
  { key: 'sports', label: '体育运动', tidV2: 1018, v1Tid: 234, childRange: [2133, 2142] },
  { key: 'handmake', label: '手工', tidV2: 1019, childRange: [2143, 2148] },
  { key: 'food', label: '美食', tidV2: 1020, v1Tid: 211, childRange: [2149, 2153] },
  { key: 'shortplay', label: '小剧场', tidV2: 1021, childRange: [2154, 2157] },
  { key: 'travel', label: '旅游出行', tidV2: 1022, childRange: [2158, 2161] },
  { key: 'rural', label: '三农', tidV2: 1023, childRange: [2162, 2166] },
  { key: 'animal', label: '动物', tidV2: 1024, v1Tid: 217, childRange: [2167, 2171] },
  { key: 'parenting', label: '亲子', tidV2: 1025, childRange: [2172, 2178] },
  { key: 'health', label: '健康', tidV2: 1026, childRange: [2179, 2184] },
  { key: 'emotion', label: '情感', tidV2: 1027, childRange: [2185, 2188] },
  { key: 'mysticism', label: '神秘学', tidV2: 1028, childRange: [2189, 2193] },
  { key: 'vlog', label: 'Vlog', tidV2: 1029, childRange: [2194, 2197] },
  { key: 'life_joy', label: '生活兴趣', tidV2: 1030, childRange: [2198, 2202] },
  { key: 'life_experience', label: '生活经验', tidV2: 1031, childRange: [2203, 2205] },
  { key: 'anime', label: '番剧', tidV2: 0, v1Tid: 13 },
  { key: 'guochuang', label: '国创', tidV2: 0, v1Tid: 167 },
  { key: 'documentary', label: '纪录片', tidV2: 0, v1Tid: 177 },
  { key: 'movie', label: '电影', tidV2: 0, v1Tid: 23 },
  { key: 'tv', label: '电视剧', tidV2: 0, v1Tid: 11 },
  { key: 'life', label: '生活', tidV2: 0, v1Tid: 160 },
];

export const VIDEO_CATEGORY_ROOTS: ReadonlyArray<{
  key: VideoCategoryKey;
  label: string;
}> = CATEGORY_DEFINITIONS.map(({ key, label }) => ({ key, label }));

const V1_NAME_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  动画: 'douga',
  音乐: 'music',
  游戏: 'game',
  娱乐: 'entertainment',
  电视剧: 'tv',
  番剧: 'anime',
  电影: 'movie',
  知识: 'knowledge',
  鬼畜: 'kichiku',
  舞蹈: 'dance',
  时尚: 'fashion',
  生活: 'life',
  国创: 'guochuang',
  纪录片: 'documentary',
  影视: 'cinephile',
  科技: 'tech',
  资讯: 'information',
  美食: 'food',
  动物圈: 'animal',
  汽车: 'car',
  运动: 'sports',
});

export function isVideoCategoryKey(value: unknown): value is VideoCategoryKey {
  return typeof value === 'string' && CATEGORY_DEFINITIONS.some((item) => item.key === value);
}

export function resolveVideoCategory(input: {
  tid?: number;
  tidV2?: number;
  tname?: string;
  tnameV2?: string;
}): VideoCategoryInfo | null {
  const rawName =
    (typeof input.tnameV2 === 'string' && input.tnameV2.trim()) ||
    (typeof input.tname === 'string' && input.tname.trim()) ||
    undefined;
  const tidV2 = typeof input.tidV2 === 'number' && Number.isInteger(input.tidV2) && input.tidV2 > 0
    ? input.tidV2
    : null;
  const tid = typeof input.tid === 'number' && Number.isInteger(input.tid) && input.tid > 0
    ? input.tid
    : null;

  const root =
    (tidV2 !== null
      ? CATEGORY_DEFINITIONS.find(
          (item) =>
            item.tidV2 === tidV2 ||
            (item.childRange && tidV2 >= item.childRange[0] && tidV2 <= item.childRange[1])
        )
      : undefined) ||
    (tid !== null ? CATEGORY_DEFINITIONS.find((item) => item.v1Tid === tid) : undefined) ||
    (rawName
      ? CATEGORY_DEFINITIONS.find(
          (item) =>
            item.label === rawName ||
            item.key === V1_NAME_ALIASES[rawName] ||
            item.key === rawName
        )
      : undefined);

  if (!root) return null;
  return { key: root.key, label: root.label, ...(rawName ? { rawName } : {}) };
}
