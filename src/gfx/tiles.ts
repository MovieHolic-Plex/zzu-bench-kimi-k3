export interface TileDef {
  name: string;
  passable: boolean;
  animated?: boolean;
}

export const LOWER_TILES: TileDef[] = [
  { name: '잔디', passable: true },
  { name: '짙은 잔디', passable: true },
  { name: '흙', passable: true },
  { name: '흙길', passable: true },
  { name: '모래', passable: true },
  { name: '돌바닥', passable: true },
  { name: '나묰바닥', passable: true },
  { name: '붉은 융단', passable: true },
  { name: '자갈길', passable: true },
  { name: '밭', passable: true },
  { name: '대리석', passable: true },
  { name: '동굴 바닥', passable: true },
  { name: '물', passable: false, animated: true },
  { name: '깊은 물', passable: false, animated: true },
  { name: '나무 다리', passable: true },
];

export const UPPER_TILES: TileDef[] = [
  { name: '나무', passable: false },
  { name: '침엽수', passable: false },
  { name: '덤불', passable: false },
  { name: '바위', passable: false },
  { name: '꽃(빨강)', passable: true },
  { name: '꽃(노랑)', passable: true },
  { name: '버섯', passable: false },
  { name: '약초', passable: false },
  { name: '성벽', passable: false },
  { name: '벽돌벽', passable: false },
  { name: '지붕(빨강)', passable: false },
  { name: '지붕(파랑)', passable: false },
  { name: '문', passable: false },
  { name: '창문', passable: false },
  { name: '간판', passable: false },
  { name: '울타리', passable: false },
  { name: '통', passable: false },
  { name: '상자', passable: false },
  { name: '탁자', passable: false },
  { name: '카운터', passable: false },
  { name: '침대', passable: false },
  { name: '책장', passable: false },
  { name: '상자(닫힘)', passable: false },
  { name: '상자(열림)', passable: false },
  { name: '횃불', passable: false },
  { name: '기둥', passable: false },
  { name: '계단', passable: true },
  { name: '묘비', passable: false },
  { name: '석상', passable: false },
  { name: '우물', passable: false },
  { name: '천막', passable: false },
  { name: '뼈', passable: true },
  { name: '성 탑', passable: false },
];

type Ctx = CanvasRenderingContext2D;

function rect(g: Ctx, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function noise(g: Ctx, x: number, y: number, s: number, colors: string[], seed: number): void {
  let n = seed * 2654435761;
  const rand = () => {
    n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    return ((n >>> 0) % 1000) / 1000;
  };
  for (let i = 0; i < 14; i++) {
    const px = x + Math.floor(rand() * (s - 3));
    const py = y + Math.floor(rand() * (s - 3));
    rect(g, px, py, 2, 2, colors[Math.floor(rand() * colors.length)]);
  }
}

function drawLower(g: Ctx, idx: number, x: number, y: number, s: number, frame: number): void {
  const u = s / 32;
  const R = (dx: number, dy: number, w: number, h: number, c: string) =>
    rect(g, x + dx * u, y + dy * u, w * u, h * u, c);
  switch (idx) {
    case 0: R(0, 0, 32, 32, '#4a8f3c'); noise(g, x, y, s, ['#5aa24a', '#3e7d32'], idx); break;
    case 1: R(0, 0, 32, 32, '#3a7a30'); noise(g, x, y, s, ['#2f6a26', '#4a8f3c'], idx); break;
    case 2: R(0, 0, 32, 32, '#8a6a44'); noise(g, x, y, s, ['#7a5a38', '#9a7a52'], idx); break;
    case 3:
      R(0, 0, 32, 32, '#4a8f3c'); noise(g, x, y, s, ['#5aa24a'], 0);
      R(4, 12, 24, 9, '#a88a5e'); R(4, 14, 24, 2, '#b89a6c');
      break;
    case 4: R(0, 0, 32, 32, '#d8c078'); noise(g, x, y, s, ['#c8b068', '#e8d088'], idx); break;
    case 5:
      R(0, 0, 32, 32, '#8d8d94');
      R(0, 0, 32, 2, '#7a7a82'); R(0, 16, 32, 2, '#7a7a82');
      R(0, 0, 2, 32, '#7a7a82'); R(16, 0, 2, 32, '#7a7a82');
      R(3, 3, 12, 12, '#9a9aa2'); R(19, 19, 12, 12, '#9a9aa2'); R(19, 3, 12, 12, '#94949c'); R(3, 19, 12, 12, '#94949c');
      break;
    case 6:
      R(0, 0, 32, 32, '#9a6b3d');
      for (let i = 0; i < 4; i++) R(0, i * 8, 32, 1.5, '#7d532c');
      R(8, 0, 1.5, 8, '#7d532c'); R(24, 8, 1.5, 8, '#7d532c'); R(8, 16, 1.5, 8, '#7d532c'); R(24, 24, 1.5, 8, '#7d532c');
      break;
    case 7:
      R(0, 0, 32, 32, '#8d1f2d'); R(2, 2, 28, 28, '#a52837');
      R(2, 2, 28, 2, '#d4a03c'); R(2, 28, 28, 2, '#d4a03c'); R(2, 2, 2, 28, '#d4a03c'); R(28, 2, 2, 28, '#d4a03c');
      break;
    case 8:
      R(0, 0, 32, 32, '#6f6f78');
      for (let i = 0; i < 6; i++) R(2 + (i * 11) % 26, 3 + (i * 17) % 24, 6, 4, i % 2 ? '#83838c' : '#5f5f68');
      break;
    case 9: R(0, 0, 32, 32, '#7a5a38'); R(0, 0, 32, 32, 'rgba(0,0,0,0)'); R(0, 4, 32, 2, '#5f4429'); R(0, 14, 32, 2, '#5f4429'); R(0, 24, 32, 2, '#5f4429'); break;
    case 10:
      R(0, 0, 32, 32, '#c8c8d2');
      R(0, 0, 32, 2, '#a8a8b4'); R(0, 16, 32, 2, '#a8a8b4'); R(4, 4, 8, 2, '#dcdce4'); R(20, 20, 8, 2, '#dcdce4');
      break;
    case 11: R(0, 0, 32, 32, '#5a5248'); noise(g, x, y, s, ['#4a443c', '#6a6258'], idx); break;
    case 12: {
      const off = frame % 2 === 0 ? 0 : 2;
      R(0, 0, 32, 32, '#3f6fb5');
      R(2 + off, 6, 8, 2, '#5a8fd0'); R(18 - off, 14, 8, 2, '#5a8fd0'); R(6 + off, 24, 8, 2, '#5a8fd0');
      break;
    }
    case 13: {
      const off = frame % 2 === 0 ? 0 : 2;
      R(0, 0, 32, 32, '#2e4f8a');
      R(4 + off, 8, 7, 2, '#3f6fb5'); R(20 - off, 20, 7, 2, '#3f6fb5');
      break;
    }
    case 14:
      R(0, 0, 32, 32, '#5f4429');
      for (let i = 0; i < 4; i++) R(2, 3 + i * 8, 28, 5, '#8a6535');
      R(0, 0, 32, 2, '#3e2c1a'); R(0, 30, 32, 2, '#3e2c1a');
      break;
    default: R(0, 0, 32, 32, '#4a8f3c');
  }
}

function drawUpper(g: Ctx, idx: number, x: number, y: number, s: number): void {
  const u = s / 32;
  const R = (dx: number, dy: number, w: number, h: number, c: string) =>
    rect(g, x + dx * u, y + dy * u, w * u, h * u, c);
  switch (idx) {
    case 0:
      R(13, 18, 6, 12, '#5f4429');
      R(6, 4, 20, 16, '#2f6a26'); R(9, 1, 14, 6, '#3e7d32'); R(10, 8, 5, 5, '#4a8f3c');
      break;
    case 1:
      R(14, 20, 4, 10, '#5f4429');
      R(8, 12, 16, 8, '#2a5a30'); R(10, 6, 12, 7, '#2f6a26'); R(12, 1, 8, 6, '#3e7d32');
      break;
    case 2: R(7, 16, 18, 12, '#2f6a26'); R(10, 12, 12, 7, '#3e7d32'); R(13, 15, 4, 4, '#4a8f3c'); break;
    case 3:
      R(8, 14, 16, 14, '#7a7a82'); R(11, 10, 10, 6, '#8d8d94'); R(13, 16, 5, 4, '#9a9aa2');
      break;
    case 4: case 5: {
      const c = idx === 4 ? '#c23a4a' : '#e0b83c';
      R(14, 14, 2, 12, '#2f6a26'); R(10, 6, 10, 10, c); R(13, 9, 4, 4, '#fff2c8');
      break;
    }
    case 6: R(12, 16, 8, 10, '#8a6535'); R(10, 10, 12, 8, '#d8c078'); R(13, 13, 6, 4, '#b89a4c'); break;
    case 7:
      R(15, 10, 2, 16, '#3a7a30'); R(10, 6, 12, 8, '#4a8f3c'); R(12, 4, 8, 4, '#7ac26a'); R(13, 8, 6, 3, '#e0e8ff');
      break;
    case 8: case 9: {
      const base = idx === 8 ? '#6a6f7c' : '#8a4f3c';
      const dark = idx === 8 ? '#565b66' : '#74402f';
      R(0, 0, 32, 32, base);
      R(0, 0, 32, 3, dark); R(0, 14, 32, 3, dark); R(0, 29, 32, 3, dark);
      R(8, 3, 2, 11, dark); R(22, 17, 2, 12, dark);
      break;
    }
    case 10: case 11: {
      const c = idx === 10 ? '#a52837' : '#2e4f8a';
      R(0, 8, 32, 24, c); R(0, 4, 16, 6, c); R(16, 0, 16, 10, c);
      R(0, 8, 32, 3, idx === 10 ? '#7c1c28' : '#22396a');
      break;
    }
    case 12:
      R(9, 8, 14, 24, '#5f4429'); R(11, 10, 10, 20, '#7a5a38');
      R(12, 13, 8, 8, '#4a3a28'); R(18, 19, 2, 2, '#d4a03c');
      break;
    case 13:
      R(11, 10, 10, 8, '#4a3a28'); R(12, 11, 8, 6, '#8fb7d8');
      R(14, 10, 1.5, 8, '#4a3a28'); R(11, 13, 10, 1.5, '#4a3a28');
      break;
    case 14:
      R(14, 12, 3, 20, '#5f4429'); R(8, 4, 16, 10, '#8a6535'); R(9, 5, 14, 8, '#e8d8a8');
      break;
    case 15:
      R(0, 16, 32, 5, '#8a6535'); R(2, 12, 3, 20, '#5f4429'); R(27, 12, 3, 20, '#5f4429');
      break;
    case 16:
      R(9, 10, 14, 18, '#8a6535'); R(11, 12, 10, 14, '#6f4f2a');
      R(10, 8, 12, 3, '#a8a8b4'); R(10, 26, 12, 3, '#5f5f68');
      break;
    case 17:
      R(8, 12, 16, 16, '#9a6b3d'); R(8, 12, 16, 3, '#7d532c'); R(8, 25, 16, 3, '#7d532c'); R(14, 12, 2, 16, '#7d532c');
      break;
    case 18:
      R(4, 20, 24, 5, '#7a5a38'); R(6, 25, 3, 7, '#5f4429'); R(23, 25, 3, 7, '#5f4429'); R(6, 18, 5, 2, '#5f4429');
      break;
    case 19:
      R(2, 16, 28, 6, '#9a6b3d'); R(2, 22, 28, 3, '#7d532c'); R(4, 25, 3, 7, '#5f4429'); R(25, 25, 3, 7, '#5f4429');
      R(8, 12, 4, 4, '#c23a4a'); R(20, 12, 4, 4, '#2e4f8a');
      break;
    case 20:
      R(5, 18, 22, 12, '#2e4f8a'); R(3, 14, 26, 5, '#f2f2f2'); R(3, 14, 26, 2, '#d8d8d8');
      break;
    case 21:
      R(6, 6, 20, 24, '#6f4f2a');
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++)
        R(8 + c * 6, 9 + r * 6, 4, 4, ['#c23a4a', '#2e4f8a', '#3a7a30', '#d4a03c'][(r + c) % 4]);
      break;
    case 22:
      R(8, 16, 16, 12, '#8a6535'); R(8, 12, 16, 5, '#6f4f2a'); R(14, 19, 4, 4, '#3e2c1a'); R(9, 17, 14, 2, '#d4a03c');
      break;
    case 23:
      R(8, 16, 16, 12, '#8a6535'); R(10, 14, 12, 6, '#3e2c1a'); R(12, 16, 8, 3, '#d4a03c');
      break;
    case 24:
      R(14, 8, 4, 20, '#4a3a28'); R(11, 4, 10, 7, '#e8a03c'); R(13, 5, 6, 4, '#ffe08a');
      break;
    case 25:
      R(12, 4, 8, 24, '#9a9aa2'); R(9, 26, 14, 4, '#7a7a82'); R(13, 8, 6, 4, '#c8c8d2');
      break;
    case 26:
      R(4, 24, 24, 4, '#7a7a82'); R(7, 18, 18, 6, '#8d8d94'); R(10, 12, 12, 6, '#9a9aa2'); R(13, 6, 6, 6, '#7a7a82');
      break;
    case 27:
      R(11, 8, 10, 18, '#8d8d94'); R(9, 26, 14, 4, '#7a7a82'); R(13, 11, 6, 3, '#5f5f68'); R(13, 17, 6, 2, '#5f5f68');
      break;
    case 28:
      R(13, 6, 6, 20, '#9a9aa2'); R(10, 2, 12, 6, '#8d8d94'); R(15, 8, 2, 8, '#7a7a82'); R(9, 26, 14, 4, '#7a7a82');
      break;
    case 29:
      R(8, 14, 16, 12, '#7a7a82'); R(6, 12, 20, 3, '#5f4429'); R(10, 17, 12, 6, '#22396a');
      R(14, 4, 4, 8, '#8a6535');
      break;
    case 30:
      R(6, 12, 20, 16, '#a52837'); R(10, 8, 12, 6, '#8d1f2d'); R(13, 16, 6, 12, '#4a3a28');
      break;
    case 31:
      R(8, 22, 6, 4, '#e8e8e8'); R(20, 20, 7, 3, '#dcdce4'); R(14, 26, 4, 3, '#c8c8d2'); R(24, 27, 3, 2, '#e8e8e8');
      break;
    case 32:
      R(8, 6, 16, 26, '#6a6f7c'); R(6, 2, 20, 6, '#565b66'); R(13, 12, 6, 6, '#22396a'); R(12, 22, 8, 10, '#4a3a28');
      break;
    default: break;
  }
}

export function drawTile(
  g: Ctx, layer: 'lower' | 'upper', idx: number,
  x: number, y: number, s: number, frame: number,
): void {
  if (layer === 'lower') drawLower(g, idx, x, y, s, frame);
  else drawUpper(g, idx, x, y, s);
}

export function tilePassable(layer: 'lower' | 'upper', idx: number): boolean {
  const defs = layer === 'lower' ? LOWER_TILES : UPPER_TILES;
  return defs[idx]?.passable ?? false;
}
