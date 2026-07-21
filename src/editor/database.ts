import {
  Project, Item, Monster, Troop, Quest, Shop, nextId, pad4, byId,
  ITEM_KIND_NAMES, ItemKind,
} from '../model/types';
import { MONSTER_KINDS, CHARS } from '../gfx/chars';
import { el, showModal, labeled, numberInput, selectInput } from './dom';

type TabId = 'actor' | 'item' | 'monster' | 'troop' | 'quest' | 'shop' | 'switch' | 'variable';

const TABS: { id: TabId; label: string }[] = [
  { id: 'actor', label: '주인공' },
  { id: 'item', label: '아이템' },
  { id: 'monster', label: '몬스터' },
  { id: 'troop', label: '부대' },
  { id: 'quest', label: '퀘스트' },
  { id: 'shop', label: '상점' },
  { id: 'switch', label: '스위치' },
  { id: 'variable', label: '변수' },
];

export function openDatabase(p: Project, onChange: () => void): void {
  const modal = showModal('데이터베이스', 900);
  modal.body.classList.add('db-body');
  let tab: TabId = 'item';

  const tabCol = el('div', { class: 'db-tabs' });
  const content = el('div', { class: 'db-content' });
  modal.body.append(tabCol, content);

  function rebuildTabs(): void {
    tabCol.textContent = '';
    for (const t of TABS) {
      const b = el('button', { class: `btn db-tab${t.id === tab ? ' active' : ''}`, text: t.label });
      b.addEventListener('click', () => { tab = t.id; rebuild(); });
      tabCol.append(b);
    }
  }

  function rebuild(): void {
    rebuildTabs();
    content.textContent = '';
    switch (tab) {
      case 'actor': buildActor(); break;
      case 'item': buildItems(); break;
      case 'monster': buildMonsters(); break;
      case 'troop': buildTroops(); break;
      case 'quest': buildQuests(); break;
      case 'shop': buildShops(); break;
      case 'switch': buildNames('스위치', p.switches); break;
      case 'variable': buildNames('변수', p.variables); break;
    }
  }

  function buildActor(): void {
    const a = p.actors[0];
    if (!a) { content.append(el('p', { text: '주인공이 없습니다.' })); return; }
    const form = el('div', { class: 'db-form' });
    const name = el('input', { type: 'text', value: a.name });
    const hp = numberInput(a.maxhp, 1, 9999);
    const atk = numberInput(a.atk, 1, 999);
    const def = numberInput(a.def, 0, 999);
    const weapon = selectInput(
      [{ value: '0', label: '(없음)' }, ...p.items.filter((i) => i.kind === 'weapon').map((i) => ({ value: String(i.id), label: i.name }))],
      String(a.weaponId),
    );
    const armor = selectInput(
      [{ value: '0', label: '(없음)' }, ...p.items.filter((i) => i.kind === 'armor').map((i) => ({ value: String(i.id), label: i.name }))],
      String(a.armorId),
    );
    const sprite = selectInput(CHARS.map((c, i) => ({ value: String(i), label: c.name })), String(a.sprite));
    form.append(
      labeled('이름', name), labeled('최대 HP', hp), labeled('공격력', atk), labeled('방어력', def),
      labeled('초기 무기', weapon), labeled('초기 방어구', armor), labeled('그래픽', sprite),
    );
    const row = el('div', { class: 'btn-row' });
    const ok = el('button', { class: 'btn primary', text: '적용' });
    ok.addEventListener('click', () => {
      a.name = name.value || a.name;
      a.maxhp = Number(hp.value) || a.maxhp;
      a.atk = Number(atk.value) || a.atk;
      a.def = Number(def.value) || 0;
      a.weaponId = Number(weapon.value);
      a.armorId = Number(armor.value);
      a.sprite = Number(sprite.value);
      onChange();
    });
    row.append(ok);
    form.append(row);
    content.append(el('div', { class: 'side-title', text: '주인공 설정' }), form);
  }

  function buildItems(): void {
    const split = el('div', { class: 'db-split' });
    const formBox = el('div', { class: 'db-form' });
    const show = (it?: Item) => {
      formBox.textContent = '';
      if (!it) return;
      const name = el('input', { type: 'text', value: it.name });
      const desc = el('input', { type: 'text', value: it.desc });
      const price = numberInput(it.price, 0, 99999);
      const kind = selectInput(
        (Object.keys(ITEM_KIND_NAMES) as ItemKind[]).map((k) => ({ value: k, label: ITEM_KIND_NAMES[k] })),
        it.kind,
      );
      const power = numberInput(it.power, 0, 999);
      formBox.append(
        labeled('이름', name), labeled('설명', desc), labeled('가격', price),
        labeled('종류', kind), labeled('위력 (공격/방어/회복)', power),
      );
      const row = el('div', { class: 'btn-row' });
      const ok = el('button', { class: 'btn primary', text: '적용' });
      ok.addEventListener('click', () => {
        it.name = name.value || it.name;
        it.desc = desc.value;
        it.price = Number(price.value) || 0;
        it.kind = kind.value as ItemKind;
        it.power = Number(power.value) || 0;
        onChange(); rebuild();
      });
      const del = el('button', { class: 'btn', text: '삭제' });
      del.addEventListener('click', () => {
        p.items = p.items.filter((x) => x.id !== it.id);
        onChange(); rebuild();
      });
      row.append(ok, del);
      formBox.append(row);
    };
    const list = el('div', { class: 'db-list' });
    for (const it of p.items) {
      const row = el('div', { class: 'db-list-item', text: `${pad4(it.id)} ${it.name} (${ITEM_KIND_NAMES[it.kind]})` });
      row.addEventListener('click', () => {
        list.querySelectorAll('.db-list-item').forEach((x) => x.classList.remove('active'));
        row.classList.add('active');
        show(it);
      });
      list.append(row);
    }
    const add = el('button', { class: 'btn', text: '아이템 추가' });
    add.addEventListener('click', () => {
      p.items.push({ id: nextId(p.items), name: '새 아이템', desc: '', price: 50, kind: 'consumable', power: 30 });
      onChange(); rebuild();
    });
    const left = el('div', { class: 'db-list-pane' });
    left.append(list, add);
    split.append(left, formBox);
    content.append(split);
  }

  function buildMonsters(): void {
    const split = el('div', { class: 'db-split' });
    const formBox = el('div', { class: 'db-form' });
    const show = (mn?: Monster) => {
      formBox.textContent = '';
      if (!mn) return;
      const name = el('input', { type: 'text', value: mn.name });
      const hp = numberInput(mn.hp, 1, 9999);
      const atk = numberInput(mn.atk, 1, 999);
      const def = numberInput(mn.def, 0, 999);
      const exp = numberInput(mn.exp, 0, 9999);
      const gold = numberInput(mn.gold, 0, 9999);
      const sprite = selectInput(MONSTER_KINDS.map((k, i) => ({ value: String(i), label: k })), String(mn.sprite));
      formBox.append(
        labeled('이름', name), labeled('HP', hp), labeled('공격력', atk), labeled('방어력', def),
        labeled('경험치', exp), labeled('골드', gold), labeled('외형', sprite),
      );
      const row = el('div', { class: 'btn-row' });
      const ok = el('button', { class: 'btn primary', text: '적용' });
      ok.addEventListener('click', () => {
        mn.name = name.value || mn.name;
        mn.hp = Number(hp.value) || mn.hp;
        mn.atk = Number(atk.value) || mn.atk;
        mn.def = Number(def.value) || 0;
        mn.exp = Number(exp.value) || 0;
        mn.gold = Number(gold.value) || 0;
        mn.sprite = Number(sprite.value);
        onChange(); rebuild();
      });
      const del = el('button', { class: 'btn', text: '삭제' });
      del.addEventListener('click', () => {
        p.monsters = p.monsters.filter((x) => x.id !== mn.id);
        onChange(); rebuild();
      });
      row.append(ok, del);
      formBox.append(row);
    };
    const list = el('div', { class: 'db-list' });
    for (const mn of p.monsters) {
      const row = el('div', { class: 'db-list-item', text: `${pad4(mn.id)} ${mn.name}` });
      row.addEventListener('click', () => {
        list.querySelectorAll('.db-list-item').forEach((x) => x.classList.remove('active'));
        row.classList.add('active');
        show(mn);
      });
      list.append(row);
    }
    const add = el('button', { class: 'btn', text: '몬스터 추가' });
    add.addEventListener('click', () => {
      p.monsters.push({ id: nextId(p.monsters), name: '새 몬스터', hp: 30, atk: 8, def: 3, exp: 10, gold: 10, sprite: 0 });
      onChange(); rebuild();
    });
    const left = el('div', { class: 'db-list-pane' });
    left.append(list, add);
    split.append(left, formBox);
    content.append(split);
  }

  function buildTroops(): void {
    const split = el('div', { class: 'db-split' });
    const formBox = el('div', { class: 'db-form' });
    const show = (tr?: Troop) => {
      formBox.textContent = '';
      if (!tr) return;
      const name = el('input', { type: 'text', value: tr.name });
      formBox.append(labeled('부대 이름', name));
      formBox.append(el('div', { class: 'side-title', text: '구성 몬스터' }));
      for (const mn of p.monsters) {
        const cnt = numberInput(tr.monsterIds.filter((id) => id === mn.id).length, 0, 5);
        cnt.addEventListener('change', () => {
          tr.monsterIds = tr.monsterIds.filter((id) => id !== mn.id);
          for (let i = 0; i < (Number(cnt.value) || 0); i++) tr.monsterIds.push(mn.id);
          onChange();
        });
        formBox.append(labeled(mn.name, cnt));
      }
      const row = el('div', { class: 'btn-row' });
      const ok = el('button', { class: 'btn primary', text: '적용' });
      ok.addEventListener('click', () => { tr.name = name.value || tr.name; onChange(); rebuild(); });
      const del = el('button', { class: 'btn', text: '삭제' });
      del.addEventListener('click', () => {
        p.troops = p.troops.filter((x) => x.id !== tr.id);
        onChange(); rebuild();
      });
      row.append(ok, del);
      formBox.append(row);
    };
    const list = el('div', { class: 'db-list' });
    for (const tr of p.troops) {
      const names = tr.monsterIds.map((id) => byId(p.monsters, id)?.name ?? '?').join(', ');
      const row = el('div', { class: 'db-list-item', text: `${pad4(tr.id)} ${tr.name} [${names}]` });
      row.addEventListener('click', () => {
        list.querySelectorAll('.db-list-item').forEach((x) => x.classList.remove('active'));
        row.classList.add('active');
        show(tr);
      });
      list.append(row);
    }
    const add = el('button', { class: 'btn', text: '부대 추가' });
    add.addEventListener('click', () => {
      p.troops.push({ id: nextId(p.troops), name: '새 부대', monsterIds: p.monsters.length > 0 ? [p.monsters[0].id] : [] });
      onChange(); rebuild();
    });
    const left = el('div', { class: 'db-list-pane' });
    left.append(list, add);
    split.append(left, formBox);
    content.append(split);
  }

  function buildQuests(): void {
    const split = el('div', { class: 'db-split' });
    const formBox = el('div', { class: 'db-form' });
    const show = (q?: Quest) => {
      formBox.textContent = '';
      if (!q) return;
      const name = el('input', { type: 'text', value: q.name });
      const desc = el('textarea', { rows: '4' });
      desc.value = q.desc;
      formBox.append(labeled('퀘스트 이름', name), labeled('설명', desc));
      const row = el('div', { class: 'btn-row' });
      const ok = el('button', { class: 'btn primary', text: '적용' });
      ok.addEventListener('click', () => { q.name = name.value || q.name; q.desc = desc.value; onChange(); rebuild(); });
      const del = el('button', { class: 'btn', text: '삭제' });
      del.addEventListener('click', () => {
        p.quests = p.quests.filter((x) => x.id !== q.id);
        onChange(); rebuild();
      });
      row.append(ok, del);
      formBox.append(row);
    };
    const list = el('div', { class: 'db-list' });
    for (const q of p.quests) {
      const row = el('div', { class: 'db-list-item', text: `${pad4(q.id)} ${q.name}` });
      row.addEventListener('click', () => {
        list.querySelectorAll('.db-list-item').forEach((x) => x.classList.remove('active'));
        row.classList.add('active');
        show(q);
      });
      list.append(row);
    }
    const add = el('button', { class: 'btn', text: '퀘스트 추가' });
    add.addEventListener('click', () => {
      p.quests.push({ id: nextId(p.quests), name: '새 퀘스트', desc: '' });
      onChange(); rebuild();
    });
    const left = el('div', { class: 'db-list-pane' });
    left.append(list, add);
    split.append(left, formBox);
    content.append(split);
  }

  function buildShops(): void {
    const split = el('div', { class: 'db-split' });
    const formBox = el('div', { class: 'db-form' });
    const show = (s?: Shop) => {
      formBox.textContent = '';
      if (!s) return;
      const name = el('input', { type: 'text', value: s.name });
      formBox.append(labeled('상점 이름', name));
      formBox.append(el('div', { class: 'side-title', text: '판매 품목' }));
      const box = el('div', { class: 'check-list' });
      for (const it of p.items) {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = s.stock.includes(it.id);
        cb.addEventListener('change', () => {
          if (cb.checked) s.stock.push(it.id);
          else s.stock = s.stock.filter((x) => x !== it.id);
          onChange();
        });
        const l = el('label', { class: 'check-item' });
        l.append(cb, el('span', { text: `${it.name} (${it.price}G)` }));
        box.append(l);
      }
      formBox.append(box);
      const row = el('div', { class: 'btn-row' });
      const ok = el('button', { class: 'btn primary', text: '적용' });
      ok.addEventListener('click', () => { s.name = name.value || s.name; onChange(); rebuild(); });
      const del = el('button', { class: 'btn', text: '삭제' });
      del.addEventListener('click', () => {
        p.shops = p.shops.filter((x) => x.id !== s.id);
        onChange(); rebuild();
      });
      row.append(ok, del);
      formBox.append(row);
    };
    const list = el('div', { class: 'db-list' });
    for (const s of p.shops) {
      const row = el('div', { class: 'db-list-item', text: `${pad4(s.id)} ${s.name} (${s.stock.length}종)` });
      row.addEventListener('click', () => {
        list.querySelectorAll('.db-list-item').forEach((x) => x.classList.remove('active'));
        row.classList.add('active');
        show(s);
      });
      list.append(row);
    }
    const add = el('button', { class: 'btn', text: '상점 추가' });
    add.addEventListener('click', () => {
      p.shops.push({ id: nextId(p.shops), name: '새 상점', stock: [] });
      onChange(); rebuild();
    });
    const left = el('div', { class: 'db-list-pane' });
    left.append(list, add);
    split.append(left, formBox);
    content.append(split);
  }

  function buildNames(title: string, arr: string[]): void {
    content.append(el('div', { class: 'side-title', text: `${title} 목록 (최대 999)` }));
    const list = el('div', { class: 'db-list names' });
    arr.forEach((n, i) => {
      const row = el('div', { class: 'db-name-row' });
      const inp = el('input', { type: 'text', value: n });
      inp.addEventListener('change', () => { arr[i] = inp.value; onChange(); });
      row.append(el('span', { class: 'db-name-id', text: pad4(i + 1) }), inp);
      list.append(row);
    });
    content.append(list);
    const add = el('button', { class: 'btn', text: `${title} 추가` });
    add.addEventListener('click', () => {
      if (arr.length >= 999) return;
      arr.push(`${title}${arr.length + 1}`);
      onChange(); rebuild();
    });
    content.append(add);
  }

  rebuild();
}
