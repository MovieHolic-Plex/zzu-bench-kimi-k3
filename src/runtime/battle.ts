import { Project, SaveState, Troop, byId } from '../model/types';
import { UI } from './screens';
import { maxHp, attack, defense, expForNext } from './stats';
import { drawMonster } from '../gfx/chars';

interface Enemy {
  id: number; name: string;
  hp: number; maxhp: number; atk: number; def: number;
  exp: number; gold: number; sprite: number;
  x: number; y: number; size: number;
  flashUntil: number; dead: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runBattle(
  p: Project, s: SaveState, troop: Troop, canEscape: boolean,
  ui: UI, g: CanvasRenderingContext2D, W: number, H: number,
): Promise<'win' | 'escape' | 'lose'> {
  const enemies: Enemy[] = troop.monsterIds
    .map((id) => byId(p.monsters, id))
    .filter((m) => m !== undefined)
    .map((m, i, arr) => ({
      id: m.id, name: m.name, hp: m.hp, maxhp: m.hp, atk: m.atk, def: m.def,
      exp: m.exp, gold: m.gold, sprite: m.sprite,
      x: (W / (arr.length + 1)) * (i + 1) - 48, y: 110, size: 96,
      flashUntil: 0, dead: false,
    }));
  if (enemies.length === 0) return 'win';

  let logText = `${troop.name}이(가) 나타났다!`;
  let playerFlashUntil = 0;
  let active = true;

  const render = (t: number) => {
    if (!active) return;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a2030');
    grad.addColorStop(0.6, '#2a3050');
    grad.addColorStop(0.62, '#3a3428');
    grad.addColorStop(1, '#2a2418');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    for (const e of enemies) {
      if (e.dead) continue;
      drawMonster(g, e.sprite, e.x, e.y, e.size, t, t < e.flashUntil);
      g.fillStyle = '#00000088';
      g.fillRect(e.x, e.y + e.size + 8, e.size, 8);
      g.fillStyle = '#c23a4a';
      g.fillRect(e.x + 1, e.y + e.size + 9, (e.size - 2) * (e.hp / e.maxhp), 6);
      g.fillStyle = '#fff';
      g.font = '13px "Malgun Gothic", sans-serif';
      g.textAlign = 'center';
      g.fillText(e.name, e.x + e.size / 2, e.y + e.size + 28);
    }
    if (t < playerFlashUntil) {
      g.fillStyle = 'rgba(255,60,60,0.25)';
      g.fillRect(0, 0, W, H);
    }
    g.fillStyle = 'rgba(8,16,48,0.9)';
    g.fillRect(0, H - 96, W, 96);
    g.strokeStyle = '#e8e8f0';
    g.lineWidth = 2;
    g.strokeRect(2, H - 94, W - 4, 92);
    const a = p.actors[0];
    g.fillStyle = '#fff';
    g.font = '16px "Malgun Gothic", sans-serif';
    g.textAlign = 'left';
    g.fillText(`${a?.name ?? '주인공'}  Lv.${s.party.level}`, 16, H - 62);
    g.fillText(`HP ${s.party.hp} / ${maxHp(p, s)}`, 16, H - 34);
    g.fillStyle = '#00000088';
    g.fillRect(150, H - 48, 200, 14);
    g.fillStyle = '#4ac26a';
    g.fillRect(151, H - 47, 198 * Math.max(0, s.party.hp / maxHp(p, s)), 12);
    g.fillStyle = '#ffe08a';
    g.textAlign = 'center';
    g.fillText(logText, W / 2, H - 116);
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render);

  const end = (r: 'win' | 'escape' | 'lose') => { active = false; return r; };
  const alive = () => enemies.filter((e) => !e.dead);

  await ui.message([logText]);

  for (;;) {
    const cmds = canEscape ? ['공격', '방어', '아이템', '도망'] : ['공격', '방어', '아이템'];
    const cmd = await ui.pickWindow(p.actors[0]?.name ?? '주인공', cmds, { cancelable: false, cls: 'rm-battle-cmd' });
    let guard = false;
    if (cmd === 0) {
      const targets = alive();
      let target = targets[0];
      if (targets.length > 1) {
        const ti = await ui.pickWindow('대상', targets.map((e) => e.name), { cancelable: true, cls: 'rm-battle-cmd' });
        if (ti === null) continue;
        target = targets[ti];
      }
      const dmg = Math.max(1, Math.round((attack(p, s) * 2 - target.def) * (0.8 + Math.random() * 0.4)));
      target.hp = Math.max(0, target.hp - dmg);
      target.flashUntil = performance.now() + 250;
      logText = `${target.name}에게 ${dmg}의 데미지!`;
      ui.floatText(String(dmg), target.x + target.size / 2, target.y + 20, 'dmg');
      if (target.hp <= 0) {
        target.dead = true;
        logText = `${target.name}을(를) 쓰러뜨렸다!`;
      }
      await delay(650);
    } else if (cmd === 1) {
      guard = true;
      logText = '방어 자세를 취했다.';
      await delay(400);
    } else if (cmd === 2) {
      const pots = Object.keys(s.items).map(Number)
        .filter((id) => (s.items[id] ?? 0) > 0 && byId(p.items, id)?.kind === 'consumable');
      if (pots.length === 0) {
        logText = '사용할 아이템이 없다.';
        await delay(500);
        continue;
      }
      const pi = await ui.pickWindow('아이템', pots.map((id) => `${byId(p.items, id)?.name} x${s.items[id]}`), { cancelable: true, cls: 'rm-battle-cmd' });
      if (pi === null) continue;
      const it = byId(p.items, pots[pi])!;
      s.items[it.id]--;
      s.party.hp = Math.min(maxHp(p, s), s.party.hp + it.power);
      logText = `${it.name}을(를) 사용! HP +${it.power}`;
      await delay(500);
    } else if (cmd === 3) {
      if (Math.random() < 0.5) {
        logText = '도망쳤다!';
        await delay(500);
        return end('escape');
      }
      logText = '도망칠 수 없다!';
      await delay(500);
    }

    if (alive().length === 0) {
      const expSum = enemies.reduce((n, e) => n + e.exp, 0);
      const goldSum = enemies.reduce((n, e) => n + e.gold, 0);
      s.gold += goldSum;
      s.party.exp += expSum;
      const msgs = [`${expSum} EXP와 ${goldSum}G를 손에 넣었다!`];
      while (s.party.exp >= expForNext(s)) {
        s.party.exp -= expForNext(s);
        s.party.level++;
        s.party.hp = Math.min(maxHp(p, s), s.party.hp + 6);
        msgs.push(`레벨 업! Lv.${s.party.level}이 되었다! (HP+6 공격+2 방어+1)`);
      }
      await ui.message(msgs);
      return end('win');
    }

    for (const e of alive()) {
      let dmg = Math.max(1, Math.round((e.atk * 2 - defense(p, s)) * (0.8 + Math.random() * 0.4)));
      if (guard) dmg = Math.max(1, Math.floor(dmg / 2));
      s.party.hp = Math.max(0, s.party.hp - dmg);
      playerFlashUntil = performance.now() + 250;
      logText = `${e.name}의 공격! ${dmg}의 데미지!`;
      await delay(600);
      if (s.party.hp <= 0) {
        logText = '눈앞이 캄캄해졌다...';
        await delay(800);
        return end('lose');
      }
    }
  }
}
