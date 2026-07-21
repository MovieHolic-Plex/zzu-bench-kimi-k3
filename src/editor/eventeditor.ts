import {
  Project, GameMap, GameEvent, EventPage, Command, IfCond,
  TRIGGER_NAMES, Trigger, MoveType, byId, pad4, swName, varName, defaultPage,
  ITEM_KIND_NAMES,
} from '../model/types';
import { CHARS, drawChar } from '../gfx/chars';
import { UPPER_TILES, drawTile } from '../gfx/tiles';
import { el, showModal, labeled, numberInput, selectInput } from './dom';

export function describeCond(p: Project, c: IfCond): string {
  switch (c.kind) {
    case 'switch': return `스위치 ${swName(p, c.id)} ${c.on ? 'ON' : 'OFF'}`;
    case 'variable': return `변수 ${varName(p, c.id)} ${c.cmp} ${c.value}`;
    case 'quest': {
      const q = byId(p.quests, c.id);
      const st = c.state === 'notstarted' ? '시작 전' : c.state === 'active' ? '진행 중' : '완료';
      return `퀘스트 [${q?.name ?? c.id}] ${st}`;
    }
    case 'item': return `아이템 [${byId(p.items, c.id)?.name ?? c.id}] 소지`;
    case 'gold': return `골드 ${c.value}G 이상`;
  }
}

export function describeCommand(p: Project, map: GameMap, cmd: Command): string {
  void map;
  switch (cmd.t) {
    case 'text': return `문장: ${cmd.lines[0] ?? ''}${cmd.lines.length > 1 ? '…' : ''}`;
    case 'choices': return `선택지: [${cmd.options.map((o) => o.label).join(' / ')}]`;
    case 'switch': return `스위치 조작: ${swName(p, cmd.id)} ${cmd.op === 'on' ? 'ON' : 'OFF'}`;
    case 'variable': {
      const ops = { set: '=', add: '+=', sub: '-=', rand: '= 랜덤 0~' } as const;
      const val = cmd.valueIsVar ? `변수 ${varName(p, cmd.value)}` : String(cmd.value);
      return `변수 조작: ${varName(p, cmd.id)} ${ops[cmd.op]}${val}`;
    }
    case 'if': return `조걶분기: ${describeCond(p, cmd.cond)}`;
    case 'transfer': {
      const m = byId(p.maps, cmd.mapId);
      return `장소 이동: ${m?.name ?? '?'} (${cmd.x}, ${cmd.y})`;
    }
    case 'shop': return `상점: ${byId(p.shops, cmd.shopId)?.name ?? '?'}`;
    case 'quest': {
      const q = byId(p.quests, cmd.id);
      return `퀘스트 ${cmd.op === 'start' ? '시작' : '완료'}: ${q?.name ?? '?'}`;
    }
    case 'item': {
      const it = byId(p.items, cmd.id);
      return `아이템 증감: ${it?.name ?? '?'} ${cmd.count >= 0 ? '+' : ''}${cmd.count}`;
    }
    case 'gold': return `골드 증감: ${cmd.amount >= 0 ? '+' : ''}${cmd.amount}G`;
    case 'battle': return `전투: ${byId(p.troops, cmd.troopId)?.name ?? '?'}${cmd.canEscape ? ' (도망 가능)' : ''}`;
    case 'heal': return `완전 회복`;
    case 'wait': return `대기: ${(cmd.frames / 60).toFixed(1)}초`;
  }
}

type Sel = { kind: 'cmd'; list: Command[]; index: number } | { kind: 'struct'; list: Command[] } | null;

export function openEventEditor(project: Project, map: GameMap, ev: GameEvent, onChange: () => void): void {
  const modal = showModal(`이벤트 편집 - ${ev.name} (${ev.x}, ${ev.y})`, 940);
  modal.body.classList.add('event-editor');
  let pageIdx = 0;
  let sel: Sel = null;

  const left = el('div', { class: 'ev-left' });
  const right = el('div', { class: 'ev-right' });
  modal.body.append(left, right);

  const page = (): EventPage => ev.pages[pageIdx];

  function switchOptions(): { value: string; label: string }[] {
    return project.switches.map((n, i) => ({ value: String(i + 1), label: `${pad4(i + 1)}:${n}` }));
  }
  function variableOptions(): { value: string; label: string }[] {
    return project.variables.map((n, i) => ({ value: String(i + 1), label: `${pad4(i + 1)}:${n}` }));
  }
  function questOptions(): { value: string; label: string }[] {
    return project.quests.map((q) => ({ value: String(q.id), label: q.name }));
  }
  function itemOptions(): { value: string; label: string }[] {
    return project.items.map((it) => ({ value: String(it.id), label: `${it.name} (${ITEM_KIND_NAMES[it.kind]})` }));
  }
  function mapOptions(): { value: string; label: string }[] {
    return project.maps.map((m) => ({ value: String(m.id), label: m.name }));
  }
  function troopOptions(): { value: string; label: string }[] {
    return project.troops.map((t) => ({ value: String(t.id), label: t.name }));
  }
  function shopOptions(): { value: string; label: string }[] {
    return project.shops.map((s) => ({ value: String(s.id), label: s.name }));
  }

  function rebuild(): void {
    rebuildLeft();
    rebuildCommands();
  }

  function rebuildLeft(): void {
    left.textContent = '';
    const nameI = el('input', { type: 'text', value: ev.name });
    nameI.addEventListener('change', () => { ev.name = nameI.value; onChange(); });
    left.append(labeled('이벤트 이름', nameI));

    const tabs = el('div', { class: 'page-tabs' });
    ev.pages.forEach((_, i) => {
      const t = el('button', { class: `btn page-tab${i === pageIdx ? ' active' : ''}`, text: String(i + 1) });
      t.addEventListener('click', () => { pageIdx = i; sel = null; rebuild(); });
      tabs.append(t);
    });
    left.append(tabs);
    const pageBtns = el('div', { class: 'btn-row' });
    const addP = el('button', { class: 'btn', text: '페이지 추가' });
    addP.addEventListener('click', () => {
      ev.pages.push(defaultPage());
      pageIdx = ev.pages.length - 1;
      sel = null;
      onChange(); rebuild();
    });
    const copyP = el('button', { class: 'btn', text: '복사' });
    copyP.addEventListener('click', () => {
      ev.pages.push(JSON.parse(JSON.stringify(page())) as EventPage);
      pageIdx = ev.pages.length - 1;
      sel = null;
      onChange(); rebuild();
    });
    const delP = el('button', { class: 'btn', text: '삭제' });
    delP.addEventListener('click', () => {
      if (ev.pages.length <= 1) return;
      ev.pages.splice(pageIdx, 1);
      pageIdx = Math.max(0, pageIdx - 1);
      sel = null;
      onChange(); rebuild();
    });
    pageBtns.append(addP, copyP, delP);
    left.append(pageBtns);

    left.append(el('div', { class: 'side-title', text: '출현 조건' }));
    const c = page().conditions;
    const condBox = el('div', { class: 'cond-box' });
    const mkSwitchCond = (label: string, onKey: 'switch1On' | 'switch2On', idKey: 'switch1Id' | 'switch2Id') => {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = c[onKey];
      const s = selectInput(switchOptions(), String(c[idKey]));
      cb.addEventListener('change', () => { c[onKey] = cb.checked; onChange(); });
      s.addEventListener('change', () => { c[idKey] = Number(s.value); onChange(); });
      const l = el('label', { class: 'cond-row' });
      l.append(cb, el('span', { text: `${label} ON:` }), s);
      condBox.append(l);
    };
    mkSwitchCond('스위치1', 'switch1On', 'switch1Id');
    mkSwitchCond('스위치2', 'switch2On', 'switch2Id');
    const vcb = el('input', { type: 'checkbox' });
    vcb.checked = c.variableOn;
    const vs = selectInput(variableOptions(), String(c.variableId));
    const vn = numberInput(c.variableValue, 0, 99999);
    vcb.addEventListener('change', () => { c.variableOn = vcb.checked; onChange(); });
    vs.addEventListener('change', () => { c.variableId = Number(vs.value); onChange(); });
    vn.addEventListener('change', () => { c.variableValue = Number(vn.value) || 0; onChange(); });
    const vl = el('label', { class: 'cond-row' });
    vl.append(vcb, el('span', { text: '변수:' }), vs, el('span', { text: '>=' }), vn);
    condBox.append(vl);
    if (project.quests.length > 0) {
      const qcb = el('input', { type: 'checkbox' });
      qcb.checked = c.questOn;
      const qs = selectInput(questOptions(), String(c.questId));
      const qst = selectInput([
        { value: 'active', label: '진행 중' }, { value: 'done', label: '완료' },
      ], c.questState);
      qcb.addEventListener('change', () => { c.questOn = qcb.checked; onChange(); });
      qs.addEventListener('change', () => { c.questId = Number(qs.value); onChange(); });
      qst.addEventListener('change', () => { c.questState = qst.value as 'active' | 'done'; onChange(); });
      const ql = el('label', { class: 'cond-row' });
      ql.append(qcb, el('span', { text: '퀘스트:' }), qs, qst);
      condBox.append(ql);
    }
    left.append(condBox);

    left.append(el('div', { class: 'side-title', text: '그래픽' }));
    const gr = page().graphic;
    const gPrev = el('canvas', { width: '64', height: '64', class: 'graphic-preview' });
    const drawPreview = () => {
      const gg = gPrev.getContext('2d')!;
      gg.clearRect(0, 0, 64, 64);
      gg.fillStyle = '#203040';
      gg.fillRect(0, 0, 64, 64);
      if (gr.kind === 'char') drawChar(gg, gr.index, gr.dir, 0, 0, 0, 64);
      else if (gr.kind === 'tile') drawTile(gg, 'upper', gr.index, 0, 0, 64, 0);
    };
    drawPreview();
    const kindSel = selectInput([
      { value: 'none', label: '없음' }, { value: 'char', label: '캐릭터' }, { value: 'tile', label: '타일' },
    ], gr.kind);
    const idxSel = selectInput(
      gr.kind === 'tile'
        ? UPPER_TILES.map((t, i) => ({ value: String(i), label: t.name }))
        : CHARS.map((ch, i) => ({ value: String(i), label: ch.name })),
      String(gr.index),
    );
    const dirSel = selectInput([
      { value: '0', label: '아래' }, { value: '1', label: '왼쪽' },
      { value: '2', label: '오른쪽' }, { value: '3', label: '위' },
    ], String(gr.dir));
    kindSel.addEventListener('change', () => {
      gr.kind = kindSel.value as 'none' | 'char' | 'tile';
      gr.index = 0;
      idxSel.textContent = '';
      const opts = gr.kind === 'tile'
        ? UPPER_TILES.map((t, i) => ({ value: String(i), label: t.name }))
        : CHARS.map((ch, i) => ({ value: String(i), label: ch.name }));
      for (const o of opts) idxSel.append(el('option', { value: o.value, text: o.label }));
      drawPreview(); onChange();
    });
    idxSel.addEventListener('change', () => { gr.index = Number(idxSel.value); drawPreview(); onChange(); });
    dirSel.addEventListener('change', () => { gr.dir = Number(dirSel.value); drawPreview(); onChange(); });
    const grRow = el('div', { class: 'graphic-row' });
    grRow.append(gPrev, labeled('종류', kindSel), labeled('그래픽', idxSel), labeled('방향', dirSel));
    left.append(grRow);

    const trigSel = selectInput(
      (Object.keys(TRIGGER_NAMES) as Trigger[]).map((t) => ({ value: t, label: TRIGGER_NAMES[t] })),
      page().trigger,
    );
    trigSel.addEventListener('change', () => { page().trigger = trigSel.value as Trigger; onChange(); });
    const moveSel = selectInput([
      { value: 'none', label: '고정' }, { value: 'random', label: '랜덤 이동' },
    ], page().moveType);
    moveSel.addEventListener('change', () => { page().moveType = moveSel.value as MoveType; onChange(); });
    left.append(labeled('작동 방식', trigSel), labeled('이동 유형', moveSel));
  }

  function eachRow(
    list: Command[], depth: number,
    visit: (cmd: Command, list: Command[], index: number, depth: number) => void,
    struct: (label: string, childList: Command[], depth: number) => void,
  ): void {
    list.forEach((cmd, index) => {
      visit(cmd, list, index, depth);
      if (cmd.t === 'if') {
        eachRow(cmd.then, depth + 1, visit, struct);
        struct('── 그 외 ──', cmd.else, depth);
        eachRow(cmd.else, depth + 1, visit, struct);
        struct('── 분기 종료 ──', list, depth);
      } else if (cmd.t === 'choices') {
        for (const o of cmd.options) {
          struct(`── [${o.label}] 의 경우 ──`, o.commands, depth);
          eachRow(o.commands, depth + 1, visit, struct);
        }
        struct('── 선택지 종료 ──', list, depth);
      }
    });
  }

  function rebuildCommands(): void {
    right.textContent = '';
    right.append(el('div', { class: 'side-title', text: '실행 내용 (커맨드)' }));
    const listEl = el('div', { class: 'cmd-list' });
    const pg = page();
    if (pg.commands.length === 0) {
      listEl.append(el('div', { class: 'cmd-row empty', text: '(비어 있음 — 아래 [삽입]으로 커맨드를 추가)' }));
    }
    const visit = (cmd: Command, list: Command[], index: number, depth: number) => {
      const row = el('div', { class: 'cmd-row' });
      row.style.paddingLeft = `${8 + depth * 18}px`;
      const marker = cmd.t === 'if' || cmd.t === 'choices' ? '◆ ' : '◇ ';
      row.append(el('span', { text: marker + describeCommand(project, map, cmd) }));
      if (sel && sel.kind === 'cmd' && sel.list === list && sel.index === index) row.classList.add('active');
      row.addEventListener('click', () => { sel = { kind: 'cmd', list, index }; rebuildCommands(); });
      row.addEventListener('dblclick', () => { sel = { kind: 'cmd', list, index }; editSelected(); });
      listEl.append(row);
    };
    const struct = (label: string, childList: Command[], depth: number) => {
      const row = el('div', { class: 'cmd-row struct' });
      row.style.paddingLeft = `${8 + depth * 18}px`;
      row.append(el('span', { text: label }));
      if (sel && sel.kind === 'struct' && sel.list === childList) row.classList.add('active');
      row.addEventListener('click', () => { sel = { kind: 'struct', list: childList }; rebuildCommands(); });
      listEl.append(row);
    };
    eachRow(pg.commands, 0, visit, struct);
    right.append(listEl);

    const row = el('div', { class: 'btn-row' });
    const ins = el('button', { class: 'btn primary', text: '삽입' });
    ins.addEventListener('click', () => insertCommand());
    const ed = el('button', { class: 'btn', text: '편집' });
    ed.addEventListener('click', () => editSelected());
    const del = el('button', { class: 'btn', text: '삭제' });
    del.addEventListener('click', () => {
      if (sel && sel.kind === 'cmd') {
        sel.list.splice(sel.index, 1);
        sel = null;
        onChange();
        rebuildCommands();
      }
    });
    row.append(ins, ed, del);
    right.append(row);
  }

  function targetList(): { list: Command[]; at: number } {
    if (!sel) return { list: page().commands, at: page().commands.length };
    if (sel.kind === 'struct') return { list: sel.list, at: sel.list.length };
    return { list: sel.list, at: sel.index + 1 };
  }

  const COMMAND_TYPES: { value: string; label: string }[] = [
    { value: 'text', label: '문장 표시' },
    { value: 'choices', label: '선택지' },
    { value: 'switch', label: '스위치 조작' },
    { value: 'variable', label: '변수 조작' },
    { value: 'if', label: '조걶분기' },
    { value: 'transfer', label: '장소 이동' },
    { value: 'shop', label: '상점 처리' },
    { value: 'quest', label: '퀘스트 시작/완료' },
    { value: 'item', label: '아이템 증감' },
    { value: 'gold', label: '골드 증감' },
    { value: 'battle', label: '전투 시작' },
    { value: 'heal', label: '완전 회복' },
    { value: 'wait', label: '대기' },
  ];

  function insertCommand(): void {
    const m2 = showModal('커맨드 삽입', 340);
    const list = el('div', { class: 'cmd-type-list' });
    for (const t of COMMAND_TYPES) {
      const b = el('button', { class: 'btn cmd-type', text: t.label });
      b.addEventListener('click', () => {
        m2.close();
        editCommand(null, t.value);
      });
      list.append(b);
    }
    m2.body.append(list);
  }

  function editSelected(): void {
    if (!sel || sel.kind !== 'cmd') return;
    const cmd = sel.list[sel.index];
    editCommand(cmd, cmd.t);
  }

  function applyCommand(existing: Command | null, cmd: Command): void {
    if (existing) {
      Object.keys(existing).forEach((k) => delete (existing as Record<string, unknown>)[k]);
      Object.assign(existing, cmd);
    } else {
      const { list, at } = targetList();
      list.splice(at, 0, cmd);
    }
    onChange();
    rebuildCommands();
  }

  function formModal(title: string): { m: ReturnType<typeof showModal>; done: (cb: () => void) => void } {
    const m = showModal(title, 480);
    const done = (cb: () => void) => {
      const row = el('div', { class: 'btn-row' });
      const ok = el('button', { class: 'btn primary', text: '확인' });
      ok.addEventListener('click', () => { cb(); m.close(); });
      const cancel = el('button', { class: 'btn', text: '취소' });
      cancel.addEventListener('click', () => m.close());
      row.append(ok, cancel);
      m.body.append(row);
    };
    return { m, done };
  }

  function editCommand(existing: Command | null, type: string): void {
    const cur = existing;
    switch (type) {
      case 'text': {
        const { m, done } = formModal('문장 표시');
        const ta = el('textarea', { rows: '5' });
        ta.value = cur?.t === 'text' ? cur.lines.join('\n') : '';
        m.body.append(labeled('문장 (줄바꿈으로 구분, \\V[n] = 변수 n)', ta));
        done(() => {
          const lines = ta.value.split('\n');
          while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
          applyCommand(cur, { t: 'text', lines });
        });
        break;
      }
      case 'choices': {
        const { m, done } = formModal('선택지');
        const inputs: HTMLInputElement[] = [];
        const existingLabels = cur?.t === 'choices' ? cur.options.map((o) => o.label) : ['예', '아니오'];
        for (let i = 0; i < 4; i++) {
          const inp = el('input', { type: 'text', value: existingLabels[i] ?? '' });
          inputs.push(inp);
          m.body.append(labeled(`선택지 ${i + 1}`, inp));
        }
        m.body.append(el('p', { class: 'hint', text: '비어 있는 항목은 무시됩니다. 각 선택지의 실행 내용은 커맨드 리스트에서 편집하세요.' }));
        done(() => {
          const labels = inputs.map((i) => i.value.trim()).filter((v) => v !== '');
          if (labels.length === 0) return;
          if (cur?.t === 'choices') {
            const next = labels.map((label, i) => ({
              label,
              commands: cur.options[i]?.commands ?? [],
            }));
            cur.options = next;
            onChange(); rebuildCommands();
          } else {
            applyCommand(null, { t: 'choices', options: labels.map((label) => ({ label, commands: [] })) });
          }
        });
        break;
      }
      case 'switch': {
        const { m, done } = formModal('스위치 조작');
        const s = selectInput(switchOptions(), cur?.t === 'switch' ? String(cur.id) : '1');
        const op = selectInput([{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }], cur?.t === 'switch' ? cur.op : 'on');
        m.body.append(labeled('스위치', s), labeled('조작', op));
        done(() => applyCommand(cur, { t: 'switch', id: Number(s.value), op: op.value as 'on' | 'off' }));
        break;
      }
      case 'variable': {
        const { m, done } = formModal('변수 조작');
        const s = selectInput(variableOptions(), cur?.t === 'variable' ? String(cur.id) : '1');
        const op = selectInput([
          { value: 'set', label: '= (대입)' }, { value: 'add', label: '+= (가산)' },
          { value: 'sub', label: '-= (감산)' }, { value: 'rand', label: '= 0 ~ N 랜덤' },
        ], cur?.t === 'variable' ? cur.op : 'set');
        const val = numberInput(cur?.t === 'variable' ? cur.value : 0, 0, 99999);
        const isVar = el('input', { type: 'checkbox' });
        if (cur?.t === 'variable') isVar.checked = cur.valueIsVar;
        const vl = el('label', { class: 'cond-row' });
        vl.append(isVar, el('span', { text: '값 대신 다른 변수의 번호 사용' }));
        m.body.append(labeled('변수', s), labeled('조작', op), labeled('값 / N', val), vl);
        done(() => applyCommand(cur, {
          t: 'variable', id: Number(s.value), op: op.value as 'set' | 'add' | 'sub' | 'rand',
          value: Number(val.value) || 0, valueIsVar: isVar.checked,
        }));
        break;
      }
      case 'if': {
        const { m, done } = formModal('조걶분기');
        const kind = selectInput([
          { value: 'switch', label: '스위치' }, { value: 'variable', label: '변수' },
          { value: 'quest', label: '퀘스트' }, { value: 'item', label: '아이템 소지' }, { value: 'gold', label: '골드 이상' },
        ], cur?.t === 'if' ? cur.cond.kind : 'switch');
        const fields = el('div');
        const buildFields = (): (() => IfCond) => {
          fields.textContent = '';
          const k = kind.value;
          const prev = cur?.t === 'if' && cur.cond.kind === k ? cur.cond : null;
          if (k === 'switch') {
            const s = selectInput(switchOptions(), prev && prev.kind === 'switch' ? String(prev.id) : '1');
            const on = selectInput([{ value: 'true', label: 'ON' }, { value: 'false', label: 'OFF' }], prev && prev.kind === 'switch' ? String(prev.on) : 'true');
            fields.append(labeled('스위치', s), labeled('상태', on));
            return () => ({ kind: 'switch', id: Number(s.value), on: on.value === 'true' });
          } else if (k === 'variable') {
            const s = selectInput(variableOptions(), prev && prev.kind === 'variable' ? String(prev.id) : '1');
            const cmp = selectInput([
              { value: '>=', label: '>=' }, { value: '==', label: '==' }, { value: '<=', label: '<=' },
            ], prev && prev.kind === 'variable' ? prev.cmp : '>=');
            const v = numberInput(prev && prev.kind === 'variable' ? prev.value : 0, 0, 99999);
            fields.append(labeled('변수', s), labeled('비교', cmp), labeled('값', v));
            return () => ({ kind: 'variable', id: Number(s.value), cmp: cmp.value as '>=' | '==' | '<=', value: Number(v.value) || 0 });
          } else if (k === 'quest') {
            const s = selectInput(questOptions(), prev && prev.kind === 'quest' ? String(prev.id) : '1');
            const st = selectInput([
              { value: 'notstarted', label: '시작 전' }, { value: 'active', label: '진행 중' }, { value: 'done', label: '완료' },
            ], prev && prev.kind === 'quest' ? prev.state : 'active');
            fields.append(labeled('퀘스트', s), labeled('상태', st));
            return () => ({ kind: 'quest', id: Number(s.value), state: st.value as 'notstarted' | 'active' | 'done' });
          } else if (k === 'item') {
            const s = selectInput(itemOptions(), prev && prev.kind === 'item' ? String(prev.id) : '1');
            fields.append(labeled('아이템', s));
            return () => ({ kind: 'item', id: Number(s.value) });
          } else {
            const v = numberInput(prev && prev.kind === 'gold' ? prev.value : 0, 0, 99999);
            fields.append(labeled('골드 (이상)', v));
            return () => ({ kind: 'gold', value: Number(v.value) || 0 });
          }
        };
        let getCond = buildFields();
        kind.addEventListener('change', () => { getCond = buildFields(); });
        m.body.append(labeled('조건 종류', kind), fields);
        done(() => {
          const cond = getCond();
          if (cur?.t === 'if') {
            cur.cond = cond;
            onChange(); rebuildCommands();
          } else {
            applyCommand(null, { t: 'if', cond, then: [], else: [] });
          }
        });
        break;
      }
      case 'transfer': {
        const { m, done } = formModal('장소 이동');
        const s = selectInput(mapOptions(), cur?.t === 'transfer' ? String(cur.mapId) : String(map.id));
        const x = numberInput(cur?.t === 'transfer' ? cur.x : 1, 0, 99);
        const y = numberInput(cur?.t === 'transfer' ? cur.y : 1, 0, 99);
        m.body.append(labeled('맵', s), labeled('X', x), labeled('Y', y));
        done(() => applyCommand(cur, { t: 'transfer', mapId: Number(s.value), x: Number(x.value) || 0, y: Number(y.value) || 0 }));
        break;
      }
      case 'shop': {
        const { m, done } = formModal('상점 처리');
        const s = selectInput(shopOptions(), cur?.t === 'shop' ? String(cur.shopId) : '1');
        m.body.append(labeled('상점', s), el('p', { class: 'hint', text: '상점은 데이터베이스에서 만듭니다.' }));
        done(() => applyCommand(cur, { t: 'shop', shopId: Number(s.value) }));
        break;
      }
      case 'quest': {
        const { m, done } = formModal('퀘스트 시작/완료');
        const s = selectInput(questOptions(), cur?.t === 'quest' ? String(cur.id) : '1');
        const op = selectInput([{ value: 'start', label: '시작' }, { value: 'complete', label: '완료' }], cur?.t === 'quest' ? cur.op : 'start');
        m.body.append(labeled('퀘스트', s), labeled('조작', op));
        done(() => applyCommand(cur, { t: 'quest', id: Number(s.value), op: op.value as 'start' | 'complete' }));
        break;
      }
      case 'item': {
        const { m, done } = formModal('아이템 증감');
        const s = selectInput(itemOptions(), cur?.t === 'item' ? String(cur.id) : '1');
        const c = numberInput(cur?.t === 'item' ? cur.count : 1, -99, 99);
        m.body.append(labeled('아이템', s), labeled('개수 (음수=제거)', c));
        done(() => applyCommand(cur, { t: 'item', id: Number(s.value), count: Number(c.value) || 0 }));
        break;
      }
      case 'gold': {
        const { m, done } = formModal('골드 증감');
        const c = numberInput(cur?.t === 'gold' ? cur.amount : 100, -99999, 99999);
        m.body.append(labeled('골드 (음수=감소)', c));
        done(() => applyCommand(cur, { t: 'gold', amount: Number(c.value) || 0 }));
        break;
      }
      case 'battle': {
        const { m, done } = formModal('전투 시작');
        const s = selectInput(troopOptions(), cur?.t === 'battle' ? String(cur.troopId) : '1');
        const esc = el('input', { type: 'checkbox' });
        esc.checked = cur?.t === 'battle' ? cur.canEscape : true;
        const el2 = el('label', { class: 'cond-row' });
        el2.append(esc, el('span', { text: '도망 가능' }));
        m.body.append(labeled('부대', s), el2);
        done(() => applyCommand(cur, { t: 'battle', troopId: Number(s.value), canEscape: esc.checked }));
        break;
      }
      case 'heal': {
        applyCommand(cur, { t: 'heal' });
        break;
      }
      case 'wait': {
        const { m, done } = formModal('대기');
        const c = numberInput(cur?.t === 'wait' ? cur.frames : 30, 1, 3600);
        m.body.append(labeled('프레임 (60 = 1초)', c));
        done(() => applyCommand(cur, { t: 'wait', frames: Number(c.value) || 30 }));
        break;
      }
      default: break;
    }
  }

  rebuild();
}
