import { Project, SaveState, Shop, byId, ITEM_KIND_NAMES } from '../model/types';
import { el } from '../editor/dom';
import { maxHp, attack, defense, expForNext } from './stats';
import { writeSaveSlot, readSaveSlot, SAVE_SLOTS } from '../model/storage';

export interface MenuHooks {
  onLoad: (state: SaveState) => void;
}

const CONFIRM_KEYS = ['z', 'Z', 'Enter', ' '];
const CANCEL_KEYS = ['x', 'X', 'Escape'];

export class UI {
  container: HTMLElement;
  private openWins: HTMLElement[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
  }

  isOpen(): boolean {
    return this.openWins.length > 0;
  }

  private push(w: HTMLElement): void {
    this.openWins.push(w);
    this.container.append(w);
  }
  private pop(w: HTMLElement): void {
    const i = this.openWins.indexOf(w);
    if (i >= 0) this.openWins.splice(i, 1);
    w.remove();
  }

  private onKey(handler: (key: string, e: KeyboardEvent) => void): () => void {
    const fn = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      handler(e.key, e);
    };
    document.addEventListener('keydown', fn, true);
    return () => document.removeEventListener('keydown', fn, true);
  }

  message(lines: string[]): Promise<void> {
    return new Promise((resolve) => {
      const w = el('div', { class: 'rm-window rm-message' });
      for (const line of lines) w.append(el('div', { class: 'rm-line', text: line }));
      w.append(el('div', { class: 'rm-more', text: '▼' }));
      this.push(w);
      const finish = () => { cleanup(); this.pop(w); resolve(); };
      const cleanup = this.onKey((k) => { if (CONFIRM_KEYS.includes(k)) finish(); });
      w.addEventListener('click', finish);
    });
  }

  pickWindow(
    title: string | null, labels: string[],
    opts: { cancelable?: boolean; cls?: string; extra?: HTMLElement } = {},
  ): Promise<number | null> {
    return new Promise((resolve) => {
      const w = el('div', { class: `rm-window rm-menu ${opts.cls ?? ''}` });
      if (title) w.append(el('div', { class: 'rm-menu-title', text: title }));
      let idx = 0;
      const rows: HTMLElement[] = [];
      labels.forEach((label, i) => {
        const r = el('div', { class: 'rm-menu-item', text: label });
        r.addEventListener('click', () => { idx = i; finish(i); });
        r.addEventListener('mousemove', () => { idx = i; highlight(); });
        rows.push(r);
        w.append(r);
      });
      if (opts.extra) w.append(opts.extra);
      const highlight = () => rows.forEach((r, i) => r.classList.toggle('active', i === idx));
      highlight();
      this.push(w);
      const finish = (v: number | null) => { cleanup(); this.pop(w); resolve(v); };
      const cleanup = this.onKey((k) => {
        if (k === 'ArrowUp' || k === 'w' || k === 'W') { idx = (idx + labels.length - 1) % labels.length; highlight(); }
        else if (k === 'ArrowDown' || k === 's' || k === 'S') { idx = (idx + 1) % labels.length; highlight(); }
        else if (CONFIRM_KEYS.includes(k)) finish(idx);
        else if (opts.cancelable !== false && CANCEL_KEYS.includes(k)) finish(null);
      });
    });
  }

  async choices(labels: string[]): Promise<number> {
    const idx = await this.pickWindow(null, labels, { cancelable: false, cls: 'rm-choices' });
    return idx ?? 0;
  }

  toast(text: string): void {
    const t = el('div', { class: 'rm-toast', text });
    this.container.append(t);
    setTimeout(() => t.classList.add('fade'), 1400);
    setTimeout(() => t.remove(), 1900);
  }

  floatText(text: string, x: number, y: number, cls = ''): void {
    const t = el('div', { class: `rm-float ${cls}`, text });
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
    this.container.append(t);
    setTimeout(() => t.remove(), 900);
  }

  async menu(p: Project, s: SaveState, hooks: MenuHooks): Promise<'close' | 'exit'> {
    for (;;) {
      const idx = await this.pickWindow('메뉴', ['아이템', '스테이터스', '퀘스트', '세이브', '불러오기', '에디터로 돌아가기'], { cls: 'rm-main-menu' });
      if (idx === null) return 'close';
      if (idx === 0) await this.itemsScreen(p, s);
      else if (idx === 1) await this.statusScreen(p, s);
      else if (idx === 2) await this.questScreen(p, s);
      else if (idx === 3) await this.saveScreen(p, s);
      else if (idx === 4) await this.loadScreen(p, hooks);
      else return 'exit';
    }
  }

  private async itemsScreen(p: Project, s: SaveState): Promise<void> {
    for (;;) {
      const ids = Object.keys(s.items).map(Number).filter((id) => (s.items[id] ?? 0) > 0);
      if (ids.length === 0) {
        await this.pickWindow('아이템', ['(소지 아이템 없음)'], { cancelable: true });
        return;
      }
      const labels = ids.map((id) => {
        const it = byId(p.items, id);
        const equip = (s.party.weaponId === id || s.party.armorId === id) ? ' [장비 중]' : '';
        return `${it?.name ?? '?'} x${s.items[id]} (${ITEM_KIND_NAMES[it?.kind ?? 'key']})${equip}`;
      });
      const idx = await this.pickWindow('아이템', labels, { cls: 'rm-items' });
      if (idx === null) return;
      const id = ids[idx];
      const it = byId(p.items, id);
      if (!it) continue;
      if (it.kind === 'consumable') {
        if (s.party.hp >= maxHp(p, s)) { this.toast('HP가 이미 가득 찼습니다.'); continue; }
        s.party.hp = Math.min(maxHp(p, s), s.party.hp + it.power);
        s.items[id]--;
        this.toast(`${it.name}을(를) 사용했다! HP +${it.power}`);
      } else if (it.kind === 'weapon') {
        s.party.weaponId = id;
        this.toast(`${it.name}을(를) 장비했다!`);
      } else if (it.kind === 'armor') {
        s.party.armorId = id;
        this.toast(`${it.name}을(를) 장비했다!`);
      } else {
        this.toast(it.desc || '중요한 물건이다.');
      }
    }
  }

  private async statusScreen(p: Project, s: SaveState): Promise<void> {
    const a = p.actors[0];
    const w = byId(p.items, s.party.weaponId);
    const ar = byId(p.items, s.party.armorId);
    const info = el('div', { class: 'rm-status' });
    const lines = [
      `이름: ${a?.name ?? '주인공'}`,
      `레벨: ${s.party.level}  (다음까지 EXP ${expForNext(s) - s.party.exp})`,
      `HP: ${s.party.hp} / ${maxHp(p, s)}`,
      `공격력: ${attack(p, s)}   방어력: ${defense(p, s)}`,
      `무기: ${w?.name ?? '(없음)'}`,
      `방어구: ${ar?.name ?? '(없음)'}`,
      `소지금: ${s.gold}G`,
    ];
    for (const l of lines) info.append(el('div', { class: 'rm-line', text: l }));
    await this.pickWindow('스테이터스', ['닫기'], { cancelable: true, extra: info, cls: 'rm-status-win' });
  }

  private async questScreen(p: Project, s: SaveState): Promise<void> {
    for (;;) {
      const qs = p.quests.filter((q) => s.quests[q.id] !== undefined);
      if (qs.length === 0) {
        await this.pickWindow('퀘스트', ['(받은 퀘스트 없음)'], { cancelable: true });
        return;
      }
      const labels = qs.map((q) => `[${s.quests[q.id] === 'done' ? '완료' : '진행 중'}] ${q.name}`);
      const idx = await this.pickWindow('퀘스트', labels, { cls: 'rm-items' });
      if (idx === null) return;
      const q = qs[idx];
      const desc = el('div', { class: 'rm-status' });
      for (const l of q.desc.split('\n')) desc.append(el('div', { class: 'rm-line', text: l }));
      await this.pickWindow(q.name, ['닫기'], { cancelable: true, extra: desc, cls: 'rm-status-win' });
    }
  }

  private async saveScreen(p: Project, s: SaveState): Promise<void> {
    const labels: string[] = [];
    for (let i = 1; i <= SAVE_SLOTS; i++) {
      const slot = readSaveSlot(p.name, i);
      labels.push(slot ? `슬롯 ${i}: ${new Date(slot.time).toLocaleString('ko-KR')}` : `슬롯 ${i}: (비어 있음)`);
    }
    const idx = await this.pickWindow('세이브', labels, { cls: 'rm-items' });
    if (idx === null) return;
    writeSaveSlot(p.name, idx + 1, JSON.parse(JSON.stringify(s)) as SaveState);
    this.toast(`슬롯 ${idx + 1}에 세이브했습니다.`);
  }

  private async loadScreen(p: Project, hooks: MenuHooks): Promise<void> {
    const labels: string[] = [];
    for (let i = 1; i <= SAVE_SLOTS; i++) {
      const slot = readSaveSlot(p.name, i);
      labels.push(slot ? `슬롯 ${i}: ${new Date(slot.time).toLocaleString('ko-KR')}` : `슬롯 ${i}: (비어 있음)`);
    }
    const idx = await this.pickWindow('불러오기', labels, { cls: 'rm-items' });
    if (idx === null) return;
    const slot = readSaveSlot(p.name, idx + 1);
    if (!slot) { this.toast('세이브 데이터가 없습니다.'); return; }
    hooks.onLoad(JSON.parse(JSON.stringify(slot.state)) as SaveState);
    this.toast(`슬롯 ${idx + 1}에서 불러왔습니다.`);
  }

  async shop(shop: Shop, p: Project, s: SaveState): Promise<void> {
    for (;;) {
      const goldEl = el('div', { class: 'rm-gold', text: `소지금: ${s.gold}G` });
      const mode = await this.pickWindow(shop.name, ['사러 온다', '팔러 온다', '그만둔다'], { extra: goldEl });
      if (mode === null || mode === 2) return;
      if (mode === 0) {
        for (;;) {
          const stock = shop.stock.map((id) => byId(p.items, id)).filter((x) => x !== undefined);
          const g2 = el('div', { class: 'rm-gold', text: `소지금: ${s.gold}G` });
          const idx = await this.pickWindow('구입', stock.map((it) => `${it.name} - ${it.price}G (소지 ${s.items[it.id] ?? 0})`), { extra: g2, cls: 'rm-items' });
          if (idx === null) break;
          const it = stock[idx];
          if (s.gold < it.price) { this.toast('골드가 부족합니다.'); continue; }
          s.gold -= it.price;
          s.items[it.id] = (s.items[it.id] ?? 0) + 1;
          this.toast(`${it.name}을(를) 샀다!`);
        }
      } else {
        for (;;) {
          const ids = Object.keys(s.items).map(Number).filter((id) => (s.items[id] ?? 0) > 0 && (byId(p.items, id)?.price ?? 0) > 0);
          if (ids.length === 0) { this.toast('팔 수 있는 아이템이 없습니다.'); break; }
          const g2 = el('div', { class: 'rm-gold', text: `소지금: ${s.gold}G` });
          const idx = await this.pickWindow('판매', ids.map((id) => {
            const it = byId(p.items, id)!;
            return `${it.name} x${s.items[id]} - ${Math.floor(it.price / 2)}G`;
          }), { extra: g2, cls: 'rm-items' });
          if (idx === null) break;
          const it = byId(p.items, ids[idx])!;
          s.items[it.id]--;
          s.gold += Math.floor(it.price / 2);
          this.toast(`${it.name}을(를) 팔았다!`);
        }
      }
    }
  }

  gameOver(): Promise<void> {
    return new Promise((resolve) => {
      const w = el('div', { class: 'rm-gameover' });
      w.append(el('div', { class: 'rm-gameover-text', text: '게임 오버' }));
      w.append(el('div', { class: 'rm-gameover-sub', text: 'Z 키를 누르세요' }));
      this.push(w);
      const cleanup = this.onKey((k) => {
        if (CONFIRM_KEYS.includes(k)) { cleanup(); this.pop(w); resolve(); }
      });
    });
  }

  destroy(): void {
    for (const w of [...this.openWins]) this.pop(w);
  }
}
