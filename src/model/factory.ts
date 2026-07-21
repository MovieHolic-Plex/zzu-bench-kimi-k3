import {
  Project, GameMap, GameEvent, Command, createMap, defaultEvent, defaultPage,
} from './types';

const U = {
  나무: 0, 침엽수: 1, 덤불: 2, 바위: 3, 꽃빨강: 4, 꽃노랑: 5, 버섯: 6, 약초: 7,
  성벽: 8, 벽돌벽: 9, 지붕빨강: 10, 지붕파랑: 11, 문: 12, 창문: 13, 간판: 14, 울타리: 15,
  통: 16, 상자: 17, 탁자: 18, 카운터: 19, 침대: 20, 책장: 21,
  상자닫힘: 22, 상자열림: 23, 횃불: 24, 기둥: 25, 계단: 26, 묘비: 27, 석상: 28, 우물: 29, 천막: 30, 뼈: 31, 성탑: 32,
} as const;

const L = {
  잔디: 0, 짙은잔디: 1, 흙: 2, 흙길: 3, 모래: 4, 돌바닥: 5, 나묰바닥: 6, 융단: 7,
  자갈길: 8, 밭: 9, 대리석: 10, 동굴: 11, 물: 12, 깊은물: 13, 다리: 14,
} as const;

function setU(m: GameMap, x: number, y: number, idx: number): void {
  if (x >= 0 && y >= 0 && x < m.width && y < m.height) m.upper[y * m.width + x] = idx + 1;
}
function setL(m: GameMap, x: number, y: number, idx: number): void {
  if (x >= 0 && y >= 0 && x < m.width && y < m.height) m.lower[y * m.width + x] = idx;
}
function fillL(m: GameMap, idx: number): void {
  m.lower.fill(idx);
}
function rectL(m: GameMap, x: number, y: number, w: number, h: number, idx: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setL(m, xx, yy, idx);
}
function rectU(m: GameMap, x: number, y: number, w: number, h: number, idx: number): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setU(m, xx, yy, idx);
}
function borderU(m: GameMap, idx: number, except: [number, number][] = []): void {
  const skip = new Set(except.map(([x, y]) => `${x},${y}`));
  for (let x = 0; x < m.width; x++) {
    if (!skip.has(`${x},0`)) setU(m, x, 0, idx);
    if (!skip.has(`${x},${m.height - 1}`)) setU(m, x, m.height - 1, idx);
  }
  for (let y = 0; y < m.height; y++) {
    if (!skip.has(`0,${y}`)) setU(m, 0, y, idx);
    if (!skip.has(`${m.width - 1},${y}`)) setU(m, m.width - 1, y, idx);
  }
}
function house(m: GameMap, x: number, y: number, w: number, h: number, roof: number, doorX: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      setU(m, xx, yy, yy < y + 2 ? roof : U.벽돌벽);
    }
  }
  setU(m, doorX, y + h - 1, U.문);
  if (doorX - 1 >= x) setU(m, doorX - 2 < x ? x : x + 1, y + h - 1, U.창문);
  if (doorX + 2 < x + w) setU(m, x + w - 2, y + h - 1, U.창문);
}

function transferEvent(id: number, x: number, y: number, mapId: number, tx: number, ty: number): GameEvent {
  const ev = defaultEvent(id, x, y);
  ev.name = `이동 ${id}`;
  const p = ev.pages[0];
  p.graphic = { kind: 'none', index: 0, dir: 0 };
  p.trigger = 'touch';
  p.commands = [{ t: 'transfer', mapId, x: tx, y: ty }];
  return ev;
}

function textCmd(...lines: string[]): Command {
  return { t: 'text', lines };
}

function buildVillage(): GameMap {
  const m = createMap(1, '아발론 마을', 30, 20);
  fillL(m, L.잔디);
  rectL(m, 14, 0, 2, 20, L.흙길);
  rectL(m, 2, 10, 26, 2, L.흙길);
  borderU(m, U.나무, [[14, 0], [15, 0], [14, 19], [15, 19]]);
  house(m, 3, 2, 6, 5, U.지붕빨강, 5);
  house(m, 12, 2, 6, 5, U.지붕파랑, 14);
  house(m, 20, 2, 7, 5, U.지붕빨강, 23);
  house(m, 3, 12, 6, 5, U.지붕빨강, 5);
  house(m, 20, 12, 6, 5, U.지붕빨강, 22);
  setU(m, 21, 9, U.카운터); setU(m, 22, 9, U.카운터); setU(m, 23, 9, U.카운터);
  setU(m, 19, 9, U.간판); setU(m, 26, 9, U.통); setU(m, 12, 9, U.우물);
  setU(m, 9, 3, U.통); setU(m, 9, 4, U.상자);
  setU(m, 7, 8, U.꽃빨강); setU(m, 8, 9, U.꽃노랑); setU(m, 26, 13, U.꽃빨강);
  setU(m, 17, 13, U.꽃노랑); setU(m, 25, 8, U.꽃노랑);
  setU(m, 2, 8, U.덤불); setU(m, 27, 17, U.덤불); setU(m, 10, 17, U.침엽수); setU(m, 18, 16, U.침엽수);

  let id = 1;
  const elder = defaultEvent(id++, 5, 7);
  elder.name = '장로';
  elder.pages[0].graphic = { kind: 'char', index: 3, dir: 0 };
  elder.pages[0].commands = [
    { t: 'if', cond: { kind: 'quest', id: 1, state: 'notstarted' }, then: [
      textCmd('【장로 엘리아스】', '오오, 용사여... 마을의 볬인', '「성배」를 도적단이 훔쳐 갔다네.', '녀석들은 동쪽 숲 너머 동굴에 있네.'),
      { t: 'quest', id: 1, op: 'start' },
      textCmd('성배를 되찾아 주게!', '동굴은 어둠의 숲 동쪽 끝이라네.'),
    ], else: [
      { t: 'if', cond: { kind: 'switch', id: 1, on: true }, then: [
        textCmd('【장로 엘리아스】', '오오... 성배를 되찾아왔군!', '자네는 아발론의 영웅일세!'),
        { t: 'item', id: 9, count: -1 },
        { t: 'gold', amount: 500 },
        { t: 'quest', id: 1, op: 'complete' },
        { t: 'switch', id: 2, op: 'on' },
        textCmd('보상으로 500G를 주겠네.', '성의 국왕 폐하께도 알리게나.'),
      ], else: [
        textCmd('【장로 엘리아스】', '도적단은 어둠의 숲 동쪽 끝,', '동굴에 숨어 있다네.', '부디 성배를 되찾아 주게나.'),
      ] },
    ] },
  ];
  const elder2 = defaultPage();
  elder2.conditions.switch1On = true; elder2.conditions.switch1Id = 2;
  elder2.graphic = { kind: 'char', index: 3, dir: 0 };
  elder2.commands = [textCmd('【장로 엘리아스】', '자네 덕분에 마을이 평화를 되찾았네.', '정말 고맙네, 용사여.')];
  elder.pages.push(elder2);
  m.events.push(elder);

  const priest = defaultEvent(id++, 14, 7);
  priest.name = '사제';
  priest.pages[0].graphic = { kind: 'char', index: 6, dir: 0 };
  priest.pages[0].commands = [
    { t: 'if', cond: { kind: 'quest', id: 2, state: 'notstarted' }, then: [
      textCmd('【사제 밀튼】', '부상자가 늘어 약초가 부족하오.', '어둠의 숲에서 「약초」를 3개만', '구해다 주시겠소?'),
      { t: 'quest', id: 2, op: 'start' },
      textCmd('약초는 숲 곳곳에서 자라고 있소.', '가까이서 조사하면 채집할 수 있소.'),
    ], else: [
      textCmd('【사제 밀튼】', '약초는 어둠의 숲에서 자라오.', '지금 \\V[1]개를 가지고 있군요.', '3개를 모아다 주시오.'),
    ] },
  ];
  const priest2 = defaultPage();
  priest2.conditions.questOn = true; priest2.conditions.questId = 2; priest2.conditions.questState = 'active';
  priest2.conditions.variableOn = true; priest2.conditions.variableId = 1; priest2.conditions.variableValue = 3;
  priest2.graphic = { kind: 'char', index: 6, dir: 0 };
  priest2.commands = [
    textCmd('【사제 밀튼】', '오오, 약초를 충분히 구해왔군요!', '이 정도면 부상자들을 치료할 수 있소.'),
    { t: 'variable', id: 1, op: 'sub', value: 3, valueIsVar: false },
    { t: 'item', id: 7, count: 3 },
    { t: 'quest', id: 2, op: 'complete' },
    textCmd('답례로 포션 3개를 드리오.', '신의 가호가 함께하길.'),
  ];
  const priest3 = defaultPage();
  priest3.conditions.questOn = true; priest3.conditions.questId = 2; priest3.conditions.questState = 'done';
  priest3.graphic = { kind: 'char', index: 6, dir: 0 };
  priest3.commands = [textCmd('【사제 밀튼】', '덕분에 많은 이들이 살았소.', '정말 고맙소, 용사여.')];
  priest.pages.push(priest2, priest3);
  m.events.push(priest);

  const merchant = defaultEvent(id++, 22, 8);
  merchant.name = '무기 상인';
  merchant.pages[0].graphic = { kind: 'char', index: 4, dir: 0 };
  merchant.pages[0].commands = [
    textCmd('【무기 상인】', '어서 오시오! 동굴에 갈 거라면', '좋은 무기와 갑옷은 필수라오.'),
    { t: 'shop', shopId: 1 },
  ];
  m.events.push(merchant);

  const innkeeper = defaultEvent(id++, 6, 17);
  innkeeper.name = '여관 주인';
  innkeeper.pages[0].graphic = { kind: 'char', index: 9, dir: 0 };
  innkeeper.pages[0].commands = [
    textCmd('【여관 주인】', '어서 오세요, 「은빛 달」 여관입니다.', '하룻밤에 10G입니다.'),
    { t: 'choices', options: [
      { label: '쉬어 간다 (10G)', commands: [
        { t: 'if', cond: { kind: 'gold', value: 10 }, then: [
          { t: 'gold', amount: -10 },
          { t: 'variable', id: 2, op: 'add', value: 1, valueIsVar: false },
          textCmd('푹 쉬었다...', 'HP가 모두 회복되었다!'),
          { t: 'heal' },
        ], else: [
          textCmd('【여관 주인】', '손님, 돈이 부족하신데요.'),
        ] },
      ] },
      { label: '그만둔다', commands: [
        textCmd('【여관 주인】', '다음에 또 오세요.'),
      ] },
    ] },
  ];
  m.events.push(innkeeper);

  const guard = defaultEvent(id++, 13, 9);
  guard.name = '경비병';
  guard.pages[0].graphic = { kind: 'char', index: 5, dir: 0 };
  guard.pages[0].commands = [
    textCmd('【경비병】', '남쪽 길은 어둠의 숲으로 이어지오.', '숲에는 늑대가 들끓으니 조심하시오.', '북쪽은 아발론 성이오.'),
  ];
  m.events.push(guard);

  const woman = defaultEvent(id++, 24, 13);
  woman.name = '마을 주민';
  woman.pages[0].graphic = { kind: 'char', index: 2, dir: 0 };
  woman.pages[0].commands = [
    textCmd('【마을 주민】', '도적단이 성배를 훔쳐간 뒤로', '밤에도 마음 놓고 못 자겠어요...'),
  ];
  m.events.push(woman);

  const man = defaultEvent(id++, 10, 13);
  man.name = '마을 주민';
  man.pages[0].graphic = { kind: 'char', index: 1, dir: 0 };
  man.pages[0].commands = [
    textCmd('【마을 주민】', '용사님이시군요! 소문은 들었어요.', '상점에서 장비를 갖추고 가세요.'),
  ];
  m.events.push(man);

  const kid = defaultEvent(id++, 16, 12);
  kid.name = '아이';
  kid.pages[0].graphic = { kind: 'char', index: 11, dir: 0 };
  kid.pages[0].commands = [
    textCmd('【아이】', '기사님이다! 나도 크면', '기사가 될 거예요!'),
  ];
  m.events.push(kid);

  m.events.push(transferEvent(id++, 14, 19, 3, 14, 1));
  m.events.push(transferEvent(id++, 15, 19, 3, 15, 1));
  m.events.push(transferEvent(id++, 14, 0, 2, 9, 13));
  m.events.push(transferEvent(id++, 15, 0, 2, 10, 13));
  return m;
}

function buildCastle(): GameMap {
  const m = createMap(2, '아발론 성', 20, 15);
  fillL(m, L.돌바닥);
  rectL(m, 9, 3, 2, 11, L.융단);
  borderU(m, U.성벽, [[9, 14], [10, 14]]);
  rectU(m, 0, 1, 20, 1, U.성벽);
  setU(m, 4, 5, U.기둥); setU(m, 15, 5, U.기둥); setU(m, 4, 9, U.기둥); setU(m, 15, 9, U.기둥);
  setU(m, 2, 3, U.석상); setU(m, 17, 3, U.석상);
  setU(m, 1, 2, U.횃불); setU(m, 18, 2, U.횃불); setU(m, 1, 12, U.횃불); setU(m, 18, 12, U.횃불);
  setU(m, 7, 2, U.창문); setU(m, 12, 2, U.창문);

  let id = 1;
  const king = defaultEvent(id++, 9, 2);
  king.name = '국왕';
  king.pages[0].graphic = { kind: 'char', index: 7, dir: 0 };
  king.pages[0].commands = [
    textCmd('【국왕 아발론】', '용사여, 잘 왔다.', '마을의 장로가 도적단 소탕을', '부탁했을 터. 힘써 주게.'),
  ];
  const king2 = defaultPage();
  king2.conditions.switch1On = true; king2.conditions.switch1Id = 2;
  king2.graphic = { kind: 'char', index: 7, dir: 0 };
  king2.commands = [
    textCmd('【국왕 아발론】', '성배를 되찾았다니, 과연 영웅이로다!', '왕실을 대표해 감사를 표하노라.'),
    { t: 'gold', amount: 1000 },
    { t: 'switch', id: 3, op: 'on' },
    textCmd('보상으로 1000G를 하사한다.'),
  ];
  const king3 = defaultPage();
  king3.conditions.switch1On = true; king3.conditions.switch1Id = 3;
  king3.graphic = { kind: 'char', index: 7, dir: 0 };
  king3.commands = [
    textCmd('【국왕 아발론】', '자네는 아발론 왕국의 자랑이다.', '앞으로도 왕국을 지켜 주게.'),
  ];
  king.pages.push(king2, king3);
  m.events.push(king);

  const g1 = defaultEvent(id++, 7, 4);
  g1.name = '근위병';
  g1.pages[0].graphic = { kind: 'char', index: 5, dir: 0 };
  g1.pages[0].commands = [textCmd('【근위병】', '폐하 앞에서 예를 갖추시오.')];
  const g2 = defaultEvent(id++, 12, 4);
  g2.name = '근위병';
  g2.pages[0].graphic = { kind: 'char', index: 5, dir: 0 };
  g2.pages[0].commands = [textCmd('【근위병】', '왕국에 평화가 깃들기를...')];
  m.events.push(g1, g2);

  m.events.push(transferEvent(id++, 9, 14, 1, 14, 1));
  m.events.push(transferEvent(id++, 10, 14, 1, 15, 1));
  return m;
}

function buildForest(): GameMap {
  const m = createMap(3, '어둠의 숲', 30, 20);
  fillL(m, L.짙은잔디);
  rectL(m, 14, 0, 2, 20, L.흙길);
  rectL(m, 14, 9, 16, 2, L.흙길);
  borderU(m, U.나무, [[14, 0], [15, 0], [29, 9], [29, 10]]);
  rectU(m, 2, 2, 7, 5, U.나무);
  rectU(m, 20, 2, 8, 4, U.침엽수);
  rectU(m, 3, 13, 7, 5, U.침엽수);
  rectU(m, 18, 13, 9, 5, U.나무);
  rectU(m, 17, 3, 1, 5, U.나무);
  setU(m, 11, 8, U.덤불); setU(m, 19, 11, U.덤불); setU(m, 5, 9, U.바위);
  setU(m, 26, 7, U.버섯); setU(m, 3, 8, U.버섯); setU(m, 12, 16, U.버섯); setU(m, 24, 12, U.덤불);
  setU(m, 10, 3, U.꽃빨강); setU(m, 22, 8, U.꽃노랑);
  m.encounterRate = 25;
  m.troopIds = [1, 2, 3];

  let id = 1;
  const herbSpots: [number, number, number][] = [
    [5, 8, 4], [11, 5, 5], [24, 6, 6], [11, 15, 7], [21, 12, 8],
  ];
  for (const [hx, hy, sw] of herbSpots) {
    const herb = defaultEvent(id++, hx, hy);
    herb.name = '약초';
    herb.pages[0].graphic = { kind: 'tile', index: U.약초, dir: 0 };
    herb.pages[0].commands = [
      { t: 'variable', id: 1, op: 'add', value: 1, valueIsVar: false },
      textCmd('약초를 채집했다! (\\V[1] / 3)'),
      { t: 'switch', id: sw, op: 'on' },
    ];
    const picked = defaultPage();
    picked.conditions.switch1On = true; picked.conditions.switch1Id = sw;
    picked.graphic = { kind: 'none', index: 0, dir: 0 };
    picked.commands = [];
    herb.pages.push(picked);
    m.events.push(herb);
  }

  const traveler = defaultEvent(id++, 14, 5);
  traveler.name = '행상인';
  traveler.pages[0].graphic = { kind: 'char', index: 4, dir: 0 };
  traveler.pages[0].commands = [
    textCmd('【행상인】', '헉헉... 늑대한테 쫓겼다오.', '동쪽 끝에 도적단 동굴이 있는데', '절대 가까이 가지 마시오!'),
  ];
  m.events.push(traveler);

  m.events.push(transferEvent(id++, 14, 0, 1, 14, 18));
  m.events.push(transferEvent(id++, 15, 0, 1, 15, 18));
  m.events.push(transferEvent(id++, 29, 9, 4, 1, 8));
  m.events.push(transferEvent(id++, 29, 10, 4, 1, 9));
  return m;
}

function buildCave(): GameMap {
  const m = createMap(4, '도적의 동굴', 25, 18);
  fillL(m, L.동굴);
  borderU(m, U.바위, [[0, 8], [0, 9]]);
  rectU(m, 5, 3, 3, 2, U.바위);
  rectU(m, 15, 12, 4, 3, U.바위);
  rectU(m, 10, 7, 2, 3, U.바위);
  setU(m, 3, 2, U.횃불); setU(m, 21, 2, U.횃불); setU(m, 3, 15, U.횃불); setU(m, 21, 15, U.횃불);
  setU(m, 7, 14, U.뼈); setU(m, 18, 5, U.뼈); setU(m, 13, 12, U.뼈);
  setU(m, 4, 6, U.상자); setU(m, 20, 13, U.통); setU(m, 22, 6, U.통);
  m.encounterRate = 20;
  m.troopIds = [4, 5, 6];

  let id = 1;
  const chest = defaultEvent(id++, 12, 4);
  chest.name = '볬 상자';
  chest.pages[0].graphic = { kind: 'tile', index: U.상자닫힘, dir: 0 };
  chest.pages[0].commands = [
    textCmd('상자를 열었다!', '고급 포션을 2개 얻었다.'),
    { t: 'item', id: 8, count: 2 },
    { t: 'switch', id: 9, op: 'on' },
  ];
  const chest2 = defaultPage();
  chest2.conditions.switch1On = true; chest2.conditions.switch1Id = 9;
  chest2.graphic = { kind: 'tile', index: U.상자열림, dir: 0 };
  chest2.commands = [textCmd('상자는 비어 있다.')];
  chest.pages.push(chest2);
  m.events.push(chest);

  const boss = defaultEvent(id++, 22, 8);
  boss.name = '도적 두목';
  boss.pages[0].graphic = { kind: 'char', index: 8, dir: 1 };
  boss.pages[0].commands = [
    textCmd('【도적 두목】', '크하하! 여기까지 기어들어 오다니', '대담한 놈이로군. 성배가 갖고 싶다면', '목숨을 걸어라!'),
    { t: 'battle', troopId: 7, canEscape: false },
    textCmd('【도적 두목】', '크윽... 강하군...', '성배는... 가져가라...'),
    { t: 'item', id: 9, count: 1 },
    { t: 'switch', id: 1, op: 'on' },
    textCmd('성배를 손에 넣었다!', '마을의 장로에게 돌아가자.'),
  ];
  const boss2 = defaultPage();
  boss2.conditions.switch1On = true; boss2.conditions.switch1Id = 1;
  boss2.graphic = { kind: 'none', index: 0, dir: 0 };
  boss2.commands = [];
  boss.pages.push(boss2);
  m.events.push(boss);

  const bandit = defaultEvent(id++, 19, 10);
  bandit.name = '도적';
  bandit.pages[0].graphic = { kind: 'char', index: 8, dir: 0 };
  bandit.pages[0].commands = [
    textCmd('【도적】', '두목님을 건드리면', '가만두지 않겠어!'),
    { t: 'battle', troopId: 4, canEscape: true },
    { t: 'switch', id: 10, op: 'on' },
  ];
  const bandit2 = defaultPage();
  bandit2.conditions.switch1On = true; bandit2.conditions.switch1Id = 10;
  bandit2.graphic = { kind: 'none', index: 0, dir: 0 };
  bandit2.commands = [];
  bandit.pages.push(bandit2);
  m.events.push(bandit);

  m.events.push(transferEvent(id++, 0, 8, 3, 28, 9));
  m.events.push(transferEvent(id++, 0, 9, 3, 28, 10));
  return m;
}

export function exampleProject(): Project {
  return {
    name: '아발론 왕국',
    version: 1,
    switches: [
      '성배 회수', '장로 보상 완료', '왕의 보상 완료',
      '약초1 채집', '약초2 채집', '약초3 채집', '약초4 채집', '약초5 채집',
      '동굴 상자', '동굴 도적 처치',
    ],
    variables: ['허브 개수', '여관 숙박 횟수'],
    maps: [buildVillage(), buildCastle(), buildForest(), buildCave()],
    items: [
      { id: 1, name: '단검', desc: '여행자의 가벼운 단검.', price: 100, kind: 'weapon', power: 3 },
      { id: 2, name: '철검', desc: '단단한 철로 만든 검.', price: 300, kind: 'weapon', power: 8 },
      { id: 3, name: '강철검', desc: '기사가 쓰는 강철검.', price: 800, kind: 'weapon', power: 15 },
      { id: 4, name: '가죽 갑옷', desc: '가죽으로 만든 갑옷.', price: 150, kind: 'armor', power: 3 },
      { id: 5, name: '철 갑옷', desc: '무겁지만 튼튼하다.', price: 400, kind: 'armor', power: 7 },
      { id: 6, name: '기사 갑옷', desc: '왕국 기사의 갑옷.', price: 900, kind: 'armor', power: 12 },
      { id: 7, name: '포션', desc: 'HP를 30 회복한다.', price: 50, kind: 'consumable', power: 30 },
      { id: 8, name: '고급 포션', desc: 'HP를 80 회복한다.', price: 150, kind: 'consumable', power: 80 },
      { id: 9, name: '성배', desc: '아발론 마을의 볬.', price: 0, kind: 'key', power: 0 },
    ],
    actors: [
      { id: 1, name: '아서', maxhp: 80, atk: 12, def: 8, weaponId: 1, armorId: 4, sprite: 0 },
    ],
    quests: [
      { id: 1, name: '도적단의 성배', desc: '도적단이 훔쳐간 마을의 성배를 되찾아 장로에게 돌려주자. 동굴은 어둠의 숲 동쪽 끝에 있다.' },
      { id: 2, name: '약초 수집', desc: '어둠의 숲에서 약초를 3개 채집해 사제에게 가져다주자.' },
    ],
    shops: [
      { id: 1, name: '무기상점', stock: [1, 2, 3, 4, 5, 6, 7, 8] },
    ],
    monsters: [
      { id: 1, name: '슬라임', hp: 18, atk: 6, def: 2, exp: 8, gold: 10, sprite: 0 },
      { id: 2, name: '늑대', hp: 30, atk: 10, def: 3, exp: 15, gold: 18, sprite: 1 },
      { id: 3, name: '도적', hp: 45, atk: 13, def: 5, exp: 25, gold: 30, sprite: 2 },
      { id: 4, name: '오크', hp: 65, atk: 17, def: 8, exp: 40, gold: 50, sprite: 3 },
      { id: 5, name: '도적 두목', hp: 140, atk: 22, def: 10, exp: 160, gold: 300, sprite: 5 },
    ],
    troops: [
      { id: 1, name: '늑대 2마리', monsterIds: [2, 2] },
      { id: 2, name: '슬라임 2마리', monsterIds: [1, 1] },
      { id: 3, name: '늑대와 슬라임', monsterIds: [2, 1] },
      { id: 4, name: '도적 2명', monsterIds: [3, 3] },
      { id: 5, name: '오크', monsterIds: [4] },
      { id: 6, name: '도적과 오크', monsterIds: [3, 4] },
      { id: 7, name: '도적 두목', monsterIds: [5, 3] },
    ],
    startMapId: 1,
    startX: 14,
    startY: 16,
  };
}

export function newProject(): Project {
  const m = createMap(1, '새 맵', 25, 18);
  fillL(m, L.잔디);
  borderU(m, U.나무);
  return {
    name: '새 프로젝트',
    version: 1,
    switches: ['스위치1'],
    variables: ['변수1'],
    maps: [m],
    items: [{ id: 1, name: '포션', desc: 'HP를 30 회복한다.', price: 50, kind: 'consumable', power: 30 }],
    actors: [{ id: 1, name: '주인공', maxhp: 80, atk: 10, def: 6, weaponId: 0, armorId: 0, sprite: 0 }],
    quests: [],
    shops: [],
    monsters: [{ id: 1, name: '슬라임', hp: 18, atk: 6, def: 2, exp: 8, gold: 10, sprite: 0 }],
    troops: [{ id: 1, name: '슬라임', monsterIds: [1] }],
    startMapId: 1,
    startX: 12,
    startY: 9,
  };
}
