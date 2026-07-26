/** Static content tables: names, breeds, personalities, customer flavour text. */

export const DOG_NAMES = [
  'ココ', 'マロン', 'ソラ', 'ハナ', 'モモ', 'レオ', 'チョコ', 'ムギ', 'ポチ', 'クッキー',
  'アズキ', 'ラテ', 'こむぎ', 'だいふく', 'てん', 'ひなた',
];

export const CAT_NAMES = [
  'ミケ', 'シロ', 'クロ', 'トラ', 'きなこ', 'みかん', 'ノア', 'ルナ', 'こはく', 'あんず',
  'とうふ', 'すず', 'ぷりん', 'ゆず', 'にぼし', 'まめ',
];

/**
 * Breeds only drive procedural drawing parameters and a display name — there is
 * no art to load, every pet is painted from these numbers.
 */
export const DOG_BREEDS = [
  { name: '柴犬', coat: '#e8b06a', accent: '#fff4e2', ear: 'perk', tail: 'curl', fluff: 0.35, size: 1.0 },
  { name: 'トイプードル', coat: '#c9a081', accent: '#f3e3d3', ear: 'floppy', tail: 'puff', fluff: 0.95, size: 0.88 },
  { name: 'ダックス', coat: '#7c4a2d', accent: '#e7b98c', ear: 'floppy', tail: 'straight', fluff: 0.2, size: 0.92 },
  { name: 'コーギー', coat: '#e0a558', accent: '#fdfbf6', ear: 'perk', tail: 'puff', fluff: 0.45, size: 0.95 },
  { name: 'シュナウザー', coat: '#9aa0a6', accent: '#e6e9ec', ear: 'floppy', tail: 'straight', fluff: 0.6, size: 0.94 },
];

export const CAT_BREEDS = [
  { name: 'ミケネコ', coat: '#f6efe6', accent: '#e2954f', ear: 'perk', tail: 'long', fluff: 0.3, size: 0.9 },
  { name: 'キジトラ', coat: '#b9946a', accent: '#7a5c3c', ear: 'perk', tail: 'long', fluff: 0.28, size: 0.92 },
  { name: 'ロシアンブルー', coat: '#a8b4c0', accent: '#dde5ec', ear: 'perk', tail: 'long', fluff: 0.35, size: 0.9 },
  { name: 'スコティッシュ', coat: '#d9c3a5', accent: '#f6ecdd', ear: 'fold', tail: 'puff', fluff: 0.7, size: 0.88 },
  { name: 'クロネコ', coat: '#4b4a55', accent: '#8d8b9a', ear: 'perk', tail: 'long', fluff: 0.32, size: 0.9 },
];

export const PERSONALITIES = [
  { id: 'genki', name: 'げんき', desc: 'あそぶのが だいすき', play: 1.35, pet: 0.9, restless: 1.3 },
  { id: 'amae', name: 'あまえんぼう', desc: 'なでられると とろける', play: 0.9, pet: 1.45, restless: 0.9 },
  { id: 'shy', name: 'はずかしがり', desc: 'なつくのに 時間がかかる', play: 1.0, pet: 1.0, restless: 0.7, affectionGain: 0.75 },
  { id: 'nonbiri', name: 'のんびり', desc: 'よく寝て よく食べる', play: 0.8, pet: 1.1, restless: 0.55 },
];

export const CUSTOMER_LOOKS = [
  { coat: '#f2867d', hair: '#4a3428' },
  { coat: '#7fb2e5', hair: '#2f2a26' },
  { coat: '#8fd0a5', hair: '#6b4a2f' },
  { coat: '#f3c86b', hair: '#3b3b46' },
  { coat: '#c8a4e8', hair: '#5b3a2a' },
];

export const CUSTOMER_LINES = {
  arrive: [
    'わんちゃん いるかな〜？',
    'かわいい子に 会いにきました！',
    'この子たち 元気そう！',
    'いい子が いたらいいな…',
  ],
  happy: [
    'この子に決めた！',
    'ずっと 大切にします！',
    'いっしょに おうちへ帰ろう',
  ],
  leave: [
    'また 来ますね…',
    'うーん、今日は やめておこうかな',
    'ちょっと 元気がないみたい…',
  ],
};

export function personalityById(id) {
  return PERSONALITIES.find((p) => p.id === id) || PERSONALITIES[0];
}
