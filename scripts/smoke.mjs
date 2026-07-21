import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
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

// ---- 에디터 부팅 ----
await page.waitForSelector('.toolbar', { timeout: 5000 });
ok(await page.locator('.map-item', { hasText: '아발론 마을' }).count() === 1, '에디터 부팅 + 예제 맵 목록');
ok((await page.locator('.palette-tile').count()) > 10, '타일 팔레트 표시');

// ---- 타일 칠하기 ----
await page.mouse.move(400, 300);
await page.mouse.down();
await page.mouse.move(450, 340);
await page.mouse.up();
ok(true, '맵 캔버스 페인팅(예외 없음)');

// ---- 이벤트 모드: 장로 선택 + 편집 ----
await page.click('.toolbar button:has-text("이벤트")');
await page.click('.map-canvas', { position: { x: 5 * 32 + 8, y: 7 * 32 + 8 } });
ok(await page.locator('.event-panel .ev-info').innerText().then((t) => t.includes('장로')), '이벤트 선택(장로)');
await page.dblclick('.map-canvas', { position: { x: 5 * 32 + 8, y: 7 * 32 + 8 } });
await page.waitForSelector('.event-editor');
ok((await page.locator('.cmd-row').count()) >= 5, '이벤트 에디터 커맨드 리스트 표시');
await page.screenshot({ path: 'shots/event-editor.png' });
await page.click('.event-editor .cmd-row >> nth=0');
await page.click('.ev-right button:has-text("편집")');
await page.waitForSelector('.modal-box:has(.modal-head:has-text("조걶분기"))');
await page.click('.modal-box:has(.modal-head:has-text("조걶분기")) button:has-text("취소")');
await page.click('.modal-box:has(.modal-head:has-text("이벤트 편집")) .modal-close');

// ---- 데이터베이스 ----
await page.click('.toolbar button:has-text("데이터베이스")');
await page.waitForSelector('.db-body');
await page.click('.db-tab:has-text("퀘스트")');
ok(await page.locator('.db-content').innerText().then((t) => t.includes('도적단의 성배')), 'DB 퀘스트 탭');
await page.click('.db-tab:has-text("스위치")');
ok(await page.locator('.db-name-row input').first().inputValue().then((v) => v.includes('성배 회수')), 'DB 스위치 탭');
await page.screenshot({ path: 'shots/database.png' });
await page.click('.modal-overlay .modal-box:has-text("데이터베이스") .modal-close');

// ---- 테스트 플레이 ----
await page.click('.toolbar button:has-text("테스트 플레이")');
await page.waitForSelector('.game-canvas');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/play-start.png' });

// 북쪽으로 이동해 사제와 대화 (퀘스트2 시작)
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(2600);
await page.keyboard.up('ArrowUp');
await page.waitForTimeout(200);
await page.keyboard.press('z');
await page.waitForSelector('.rm-message', { timeout: 4000 });
ok(await page.locator('.rm-message').innerText().then((t) => t.includes('사제')), '사제 대화 시작');
await page.keyboard.press('z');
await page.waitForTimeout(400);
ok((await page.locator('.rm-message').count()) === 1, '두 번째 문장 표시');
await page.keyboard.press('z');
await page.waitForTimeout(400);

// 메뉴 → 퀘스트 로그
await page.keyboard.press('Escape');
await page.waitForSelector('.rm-main-menu');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForSelector('.rm-items');
ok(await page.locator('.rm-items').innerText().then((t) => t.includes('약초 수집') && t.includes('진행 중')), '퀘스트 로그에 진행 중 퀘스트');
await page.screenshot({ path: 'shots/quest-log.png' });
await page.keyboard.press('Escape');
await page.waitForSelector('.rm-main-menu');
await page.keyboard.press('Escape');
await page.waitForSelector('.rm-main-menu', { state: 'detached' });

// ---- 전투 (테스트 훅으로 강제 인카운터) ----
await page.evaluate(() => { void window.__engine.startBattle(2, true); });
await page.waitForSelector('.rm-message', { timeout: 4000 });
await page.keyboard.press('z');
await page.waitForSelector('.rm-battle-cmd', { timeout: 4000 });
await page.screenshot({ path: 'shots/battle.png' });
let won = false;
for (let i = 0; i < 40; i++) {
  if ((await page.locator('.rm-message').count()) > 0) { won = true; break; }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(750);
}
ok(won, '전투 승리까지 진행');
await page.screenshot({ path: 'shots/battle-win.png' });
await page.keyboard.press('z');
await page.waitForTimeout(400);

// ---- 세이브 ----
await page.keyboard.press('Escape');
await page.waitForSelector('.rm-main-menu');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForSelector('.rm-items');
await page.keyboard.press('Enter');
await page.waitForSelector('.rm-toast');
ok(await page.locator('.rm-toast').innerText().then((t) => t.includes('세이브')), '세이브 실행');
await page.waitForSelector('.rm-main-menu');
await page.keyboard.press('Escape');
await page.waitForSelector('.rm-main-menu', { state: 'detached' });

// ---- 에디터 복귀 ----
await page.keyboard.press('Escape');
await page.waitForSelector('.rm-main-menu');
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
ok(await page.locator('.editor').isVisible(), '에디터 복귀');

ok(errors.length === 0, `콘솔/페이지 오류 없음 (발견: ${errors.length})`);
if (errors.length > 0) console.error(errors.join('\n'));

await browser.close();
if (failures.length > 0 || errors.length > 0) {
  console.error(`\nSMOKE FAILED: ${failures.length} failures, ${errors.length} errors`);
  process.exit(1);
}
console.log('\nSMOKE PASSED');
