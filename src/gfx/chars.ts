export type HatType = 'none' | 'hood' | 'helmet' | 'crown' | 'straw';

export interface CharDef {
  name: string;
  skin: string; hair: string; cloth: string; accent: string;
  hat: HatType;
}

export const CHARS: CharDef[] = [
  { name: '기사(주인공)', skin: '#f0c8a0', hair: '#6a4a2a', cloth: '#5a6f8a', accent: '#c8c8d2', hat: 'helmet' },
  { name: '마을 주민(남)', skin: '#f0c8a0', hair: '#4a3a28', cloth: '#7a5a38', accent: '#5f4429', hat: 'none' },
  { name: '마을 주민(여)', skin: '#f0c8a0', hair: '#8a5a2a', cloth: '#8a5a6a', accent: '#e8d8a8', hat: 'none' },
  { name: '장로', skin: '#e8c8a8', hair: '#d8d8d8', cloth: '#5a4a6a', accent: '#d4a03c', hat: 'none' },
  { name: '상인', skin: '#f0c8a0', hair: '#2a2a2a', cloth: '#3a6a4a', accent: '#d4a03c', hat: 'straw' },
  { name: '경비병', skin: '#e8b890', hair: '#3a3a3a', cloth: '#6a6f7c', accent: '#8d1f2d', hat: 'helmet' },
  { name: '사제', skin: '#f0c8a0', hair: '#6a5a4a', cloth: '#e8e8e8', accent: '#d4a03c', hat: 'hood' },
  { name: '왕', skin: '#f0c8a0', hair: '#d8d8d8', cloth: '#8d1f2d', accent: '#d4a03c', hat: 'crown' },
  { name: '도적', skin: '#d8b090', hair: '#2a2a2a', cloth: '#3a3a3a', accent: '#5f4429', hat: 'hood' },
  { name: '여관 주인', skin: '#f0c8a0', hair: '#7a3a2a', cloth: '#4a5a7a', accent: '#e8e8e8', hat: 'none' },
  { name: '대장장이', skin: '#e8b890', hair: '#3a2a1a', cloth: '#4a443c', accent: '#8a6535', hat: 'none' },
  { name: '아이', skin: '#f0c8a0', hair: '#c8a03c', cloth: '#3a7a30', accent: '#e8d8a8', hat: 'none' },
];

type Ctx = CanvasRenderingContext2D;

export function drawChar(
  g: Ctx, idx: number, dir: number, frame: number,
  x: number, y: number, s: number,
): void {
  const d = CHARS[idx % CHARS.length];
  const u = s / 32;
  const R = (dx: number, dy: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x + dx * u, y + dy * u, w * u, h * u);
  };
  const step = frame % 2 === 0 ? 0 : 2;
  R(11, 26, 4, 5, d.accent);
  R(17, 26, 4, 5, d.accent);
  if (frame % 2 === 1) { R(11, 28 - step, 4, 3 + step, d.accent); R(17, 26 + step, 4, 5 - step, d.accent); }
  R(10, 15, 12, 12, d.cloth);
  R(10, 15, 12, 3, d.accent);
  R(9, 17, 3, 8, d.cloth);
  R(20, 17, 3, 8, d.cloth);
  R(11, 4, 10, 10, d.skin);
  if (dir === 0) {
    R(13, 8, 2, 2, '#202020');
    R(17, 8, 2, 2, '#202020');
    R(14, 11, 4, 1, '#b08060');
  } else if (dir === 1) {
    R(12, 8, 2, 2, '#202020');
  } else if (dir === 2) {
    R(18, 8, 2, 2, '#202020');
  }
  if (d.hat === 'helmet') {
    R(10, 2, 12, 6, d.accent);
    R(10, 6, 2, 6, d.accent);
    R(20, 6, 2, 6, d.accent);
    if (dir === 3) R(11, 4, 10, 10, d.accent);
    R(14, 0, 4, 3, '#8d1f2d');
  } else if (d.hat === 'hood') {
    R(10, 2, 12, 5, d.cloth);
    R(10, 4, 3, 9, d.cloth);
    R(19, 4, 3, 9, d.cloth);
    if (dir === 3) R(11, 4, 10, 10, d.cloth);
  } else if (d.hat === 'crown') {
    R(11, 2, 10, 3, '#d4a03c');
    R(11, 0, 2, 3, '#d4a03c'); R(15, 0, 2, 3, '#d4a03c'); R(19, 0, 2, 3, '#d4a03c');
    R(11, 5, 10, 3, d.hair);
    if (dir === 3) R(11, 4, 10, 10, d.hair);
  } else if (d.hat === 'straw') {
    R(8, 4, 16, 3, '#d8c078');
    R(12, 1, 8, 4, '#c8b068');
    if (dir === 3) R(11, 5, 10, 9, d.hair);
  } else {
    R(11, 2, 10, 5, d.hair);
    if (dir === 3) R(11, 4, 10, 10, d.hair);
    if (dir === 0) { R(10, 5, 2, 4, d.hair); R(20, 5, 2, 4, d.hair); }
  }
}

export const MONSTER_KINDS = ['슬라임', '늑대', '도적', '오크', '스켈레톤', '암흑기사'] as const;

const MONSTER_HUES: Record<string, [string, string]> = {
  슬라임: ['#4aa24a', '#7ac26a'],
  늑대: ['#6a6f7c', '#9a9aa2'],
  도적: ['#3a3a3a', '#5f4429'],
  오크: ['#5a7a3a', '#3a5a26'],
  스켈레톤: ['#d8d8d8', '#a8a8b4'],
  암흑기사: ['#2a2a3a', '#8d1f2d'],
};

export function drawMonster(
  g: Ctx, kindIdx: number, x: number, y: number, size: number, t: number, flash: boolean,
): void {
  const kind = MONSTER_KINDS[kindIdx % MONSTER_KINDS.length];
  const [main, sub] = MONSTER_HUES[kind];
  const bob = Math.sin(t / 300) * size * 0.03;
  const u = size / 32;
  const R = (dx: number, dy: number, w: number, h: number, c: string) => {
    g.fillStyle = flash ? '#ffffff' : c;
    g.fillRect(x + dx * u, y + bob + dy * u, w * u, h * u);
  };
  switch (kind) {
    case '슬라임':
      R(6, 14, 20, 14, main); R(9, 9, 14, 7, sub);
      R(11, 16, 3, 4, '#103010'); R(19, 16, 3, 4, '#103010');
      R(14, 23, 5, 2, '#103010');
      break;
    case '늑대':
      R(5, 14, 18, 10, main); R(21, 10, 8, 8, main);
      R(23, 6, 2, 5, sub); R(27, 6, 2, 5, sub);
      R(24, 13, 2, 2, '#ff4040'); R(28, 15, 3, 2, sub);
      R(7, 24, 3, 6, main); R(17, 24, 3, 6, main); R(2, 12, 4, 3, sub);
      break;
    case '도적':
      R(11, 26, 4, 5, sub); R(17, 26, 4, 5, sub);
      R(10, 14, 12, 13, main); R(9, 16, 3, 8, main); R(20, 16, 3, 8, main);
      R(11, 4, 10, 10, '#d8b090');
      R(10, 2, 12, 5, main); R(10, 4, 3, 8, main); R(19, 4, 3, 8, main);
      R(13, 8, 2, 2, '#202020'); R(17, 8, 2, 2, '#202020');
      R(22, 18, 7, 2, '#c8c8d2');
      break;
    case '오크':
      R(10, 25, 5, 6, sub); R(17, 25, 5, 6, sub);
      R(8, 13, 16, 13, main); R(6, 14, 4, 9, main); R(22, 14, 4, 9, main);
      R(10, 3, 12, 11, main);
      R(12, 7, 3, 3, '#ff4040'); R(18, 7, 3, 3, '#ff4040');
      R(13, 12, 2, 3, '#e8e8e8'); R(18, 12, 2, 3, '#e8e8e8');
      R(10, 1, 3, 3, '#d8c078'); R(20, 1, 3, 3, '#d8c078');
      break;
    case '스켈레톤':
      R(11, 26, 4, 5, main); R(17, 26, 4, 5, main);
      R(10, 15, 12, 11, main);
      R(12, 17, 8, 1.5, '#5f5f68'); R(12, 20, 8, 1.5, '#5f5f68'); R(12, 23, 8, 1.5, '#5f5f68');
      R(9, 16, 3, 8, main); R(20, 16, 3, 8, main);
      R(11, 3, 10, 11, main);
      R(13, 7, 2.5, 3, '#202020'); R(17, 7, 2.5, 3, '#202020');
      R(14, 11, 4, 2, '#5f5f68');
      break;
    case '암흑기사':
      R(10, 25, 5, 6, main); R(17, 25, 5, 6, main);
      R(9, 13, 14, 13, main); R(9, 13, 14, 3, sub);
      R(7, 15, 4, 10, main); R(21, 15, 4, 10, main);
      R(10, 2, 12, 11, main);
      R(12, 6, 8, 2, '#ff4040');
      R(8, 0, 4, 5, sub); R(20, 0, 4, 5, sub);
      R(23, 10, 2, 16, '#c8c8d2'); R(21, 8, 6, 3, '#c8c8d2');
      break;
  }
}
