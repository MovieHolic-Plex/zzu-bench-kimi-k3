import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5317';
mkdirSync('shots', { recursive: true });

const errors = [];
const failures = [];
function ok(cond, msg) {
  if (cond) console.log(`OK   ${msg}`);
  else { failures.push(msg); console.error(`FAIL ${msg}`); }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.toolbar');

const state = () => page.evaluate(() => {
  const s = window.__engine.state;
  return { mapId: s.mapId, gold: s.gold, quests: { ...s.quests }, sw: [...s.switches], vars: [...s.variables], items: { ...s.items } };
});
const runEvent = (name, nth = 0) => page.evaluate(([n, k]) => {
  const eng = window.__engine;
  const inst = eng.events.filter((e) => e.def.name === n)[k];
  if (!inst) throw new Error(`event not found: ${n} #${k}`);
  void eng.runEvent(inst, true);
}, [name, nth]);
const teleport = (mapId, x, y) => page.evaluate(([m, x, y]) => { window.__engine.loadMap(m, x, y, 0); }, [mapId, x, y]);
const drain = async () => {
  for (let i = 0; i < 40; i++) {
    if ((await page.locator('.rm-message').count()) > 0) {
      await page.keyboard.press('z');
      await page.waitForTimeout(200);
    } else {
      await page.waitForTimeout(250);
      if ((await page.locator('.rm-message').count()) === 0) return;
    }
  }
};

await page.click('.toolbar button:has-text("테스트 플레이")');
await page.waitForSelector('.game-canvas');
await page.waitForTimeout(400);

// 1. 장로: 퀘스트1 시작
await runEvent('장로');
await drain();
let st = await state();
ok(st.quests[1] === 'active', '퀘스트1 시작 (장로)');

// 2. 상점: 포션 구입
await runEvent('무기 상인');
await drain();
await page.waitForSelector('.rm-menu:has-text("무기상점")');
await page.keyboard.press('Enter');
await page.waitForSelector('.rm-items');
for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForSelector('.rm-toast');
await page.screenshot({ path: 'shots/shop.png' });
await page.keyboard.press('Escape');
await page.waitForSelector('.rm-menu:has-text("무기상점")');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
st = await state();
ok(st.gold === 50 && (st.items[7] ?? 0) === 1, `상점 구매 (gold=${st.gold}, potion=${st.items[7]})`);

// 3. 사제: 퀘스트2 시작
await runEvent('사제');
await drain();
st = await state();
ok(st.quests[2] === 'active', '퀘스트2 시작 (사제)');

// 4. 숲에서 약초 3개 채집 (변수 + 스위치)
await teleport(3, 14, 18);
for (let k = 0; k < 3; k++) {
  await runEvent('약초', k);
  await drain();
  await page.waitForTimeout(200);
}
st = await state();
ok(st.vars[0] === 3 && st.sw[3] && st.sw[4] && st.sw[5], `약초 3개 채집 (변수=${st.vars[0]})`);

// 5. 사제: 변수 조건 페이지로 퀘스트2 완료
await teleport(1, 14, 9);
await runEvent('사제');
await drain();
st = await state();
ok(st.quests[2] === 'done' && st.vars[0] === 0 && (st.items[7] ?? 0) === 4, '퀘스트2 완료 (변수 조건 페이지)');

// 6. 걸어서 맵 이동 (접촉 트리거)
await teleport(1, 14, 18);
await page.keyboard.down('ArrowDown');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowDown');
await page.waitForTimeout(1500);
st = await state();
ok(st.mapId === 3, `접촉 트리거로 맵 이동 (mapId=${st.mapId})`);

// 7. 동굴 보스전 → 성배 획득
await page.evaluate(() => {
  const s = window.__engine.state;
  s.party.level = 8;
  s.party.hp = 126;
});
await teleport(4, 20, 8);
await page.waitForTimeout(300);
await runEvent('도적 두목');
let shotTaken = false;
let settled = false;
for (let i = 0; i < 150; i++) {
  if ((await page.locator('.rm-battle-cmd').count()) > 0) {
    if (!shotTaken) { await page.screenshot({ path: 'shots/boss-battle.png' }); shotTaken = true; }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    continue;
  }
  if ((await page.locator('.rm-message').count()) > 0) {
    await page.keyboard.press('z');
    await page.waitForTimeout(250);
    continue;
  }
  const busy = await page.evaluate(() => window.__engine.battleActive || window.__engine.blockingRuns > 0);
  if (!busy) { settled = true; break; }
  await page.waitForTimeout(400);
}
ok(settled, '보스 이벤트 종료까지 진행');
st = await state();
ok((st.items[9] ?? 0) === 1 && st.sw[0] === true, '성배 획득 + 스위치 ON');

// 8. 장로 보상 (퀘스트1 완료)
await teleport(1, 5, 9);
await runEvent('장로');
await drain();
st = await state();
ok(st.quests[1] === 'done' && st.sw[1] === true && st.gold === 880, `퀘스트1 완료 + 보상 (gold=${st.gold})`);

// 9. 국왕 추가 보상
await teleport(2, 9, 12);
await runEvent('국왕');
await drain();
st = await state();
ok(st.sw[2] === true && st.gold === 1880, `국왕 보상 (gold=${st.gold})`);

// 10. 에디터 복귀 후 프로젝트 저장/불러오기
await page.keyboard.press('Escape');
await page.waitForSelector('.rm-main-menu');
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForSelector('.editor');
const dl = page.waitForEvent('download');
await page.click('.toolbar button:has-text("저장")');
const download = await dl;
const path = await download.path();
const { readFileSync } = await import('node:fs');
const saved = JSON.parse(readFileSync(path, 'utf-8'));
ok(saved.name === '아발론 왕국' && saved.maps.length === 4, '프로젝트 JSON 저장');
writeFileSync('shots/project-export.json', JSON.stringify(saved).slice(0, 200));
const fc = page.waitForEvent('filechooser');
await page.click('.toolbar button:has-text("불러오기")');
const chooser = await fc;
await chooser.setFiles(path);
await page.waitForTimeout(600);
ok(await page.locator('.map-item', { hasText: '아발론 마을' }).count() === 1, '프로젝트 불러오기');

ok(errors.length === 0, `콘솔/페이지 오류 없음 (발견: ${errors.length})`);
if (errors.length > 0) console.error(errors.join('\n'));

await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.error(`\nE2E FAILED: ${failures.length} failures, ${errors.length} errors`);
  process.exit(1);
}
console.log('\nE2E PASSED');
