import {
  Project, GameMap, GameEvent, TILE, byId, nextId, createMap, defaultEvent,
} from '../model/types';
import { LOWER_TILES, UPPER_TILES, drawTile } from '../gfx/tiles';
import { drawChar } from '../gfx/chars';
import { el, showModal, confirmDialog, labeled, numberInput } from './dom';
import { openEventEditor } from './eventeditor';
import { openDatabase } from './database';

export type EditorMode = 'lower' | 'upper' | 'event' | 'start';
export type EditorTool = 'pencil' | 'rect' | 'fill';

export interface EditorHooks {
  onChange: () => void;
  onPlay: () => void;
  onNewProject: () => void;
  onExampleProject: () => void;
  onLoadProject: () => void;
  onSaveProject: () => void;
}

export class Editor {
  project: Project;
  hooks: EditorHooks;
  mode: EditorMode = 'lower';
  tool: EditorTool = 'pencil';
  zoom = 1;
  selectedLower = 0;
  selectedUpper = 1;
  selectedEvent: GameEvent | null = null;
  currentMap: GameMap;

  root = el('div', { class: 'editor' });
  private canvas = el('canvas', { class: 'map-canvas' });
  private g: CanvasRenderingContext2D;
  private mapListEl = el('div', { class: 'map-list' });
  private paletteEl = el('div', { class: 'palette' });
  private eventPanel = el('div', { class: 'event-panel' });
  private statusEl = el('div', { class: 'statusbar' });
  private modeBtns = new Map<EditorMode, HTMLButtonElement>();
  private painting = false;
  private rectStart: { x: number; y: number } | null = null;
  private rectEnd: { x: number; y: number } | null = null;
  private draggingEvent = false;
  private animFrame = 0;

  constructor(project: Project, hooks: EditorHooks) {
    this.project = project;
    this.hooks = hooks;
    this.currentMap = project.maps[0];
    this.g = this.canvas.getContext('2d')!;
    this.build();
    this.refreshMapList();
    this.refreshPalette();
    this.refreshEventPanel();
    this.resizeCanvas();
    this.render();
    setInterval(() => { this.animFrame++; this.render(); }, 400);
  }

  private build(): void {
    const bar = el('div', { class: 'toolbar' });
    const mkBtn = (label: string, title: string, cb: () => void): HTMLButtonElement => {
      const b = el('button', { class: 'btn', text: label, title });
      b.addEventListener('click', cb);
      bar.append(b);
      return b;
    };
    mkBtn('새 프로젝트', '빈 프로젝트를 만듭니다', () => this.hooks.onNewProject());
    mkBtn('예제 프로젝트', '중세 RPG 예제를 엽니다', () => this.hooks.onExampleProject());
    mkBtn('불러오기', '프로젝트 JSON 파일을 엽니다', () => this.hooks.onLoadProject());
    mkBtn('저장', '프로젝트 JSON 파일로 저장합니다', () => this.hooks.onSaveProject());
    mkBtn('데이터베이스', '아이템/몬스터/퀘스트/상점/스위치/변수 관리', () => {
      openDatabase(this.project, () => { this.hooks.onChange(); this.refreshEventPanel(); });
    });
    bar.append(el('span', { class: 'sep' }));
    for (const [mode, label] of [['lower', '하층'], ['upper', '상층'], ['event', '이벤트'], ['start', '시작위치']] as [EditorMode, string][]) {
      const b = el('button', { class: 'btn', text: label });
      b.addEventListener('click', () => this.setMode(mode));
      this.modeBtns.set(mode, b);
      bar.append(b);
    }
    bar.append(el('span', { class: 'sep' }));
    for (const [tool, label] of [['pencil', '연필'], ['rect', '사각'], ['fill', '채우기']] as [EditorTool, string][]) {
      const b = el('button', { class: 'btn tool-btn', text: label, dataset: '' });
      b.dataset.tool = tool;
      b.addEventListener('click', () => { this.tool = tool; this.refreshToolbar(); });
      bar.append(b);
    }
    bar.append(el('span', { class: 'sep' }));
    const zoomBtn = mkBtn('줌 1x', '확대/축소', () => {
      this.zoom = this.zoom === 1 ? 2 : 1;
      zoomBtn.textContent = `줌 ${this.zoom}x`;
      this.resizeCanvas();
      this.render();
    });
    bar.append(el('span', { class: 'sep' }));
    const play = el('button', { class: 'btn primary', text: '▶ 테스트 플레이' });
    play.addEventListener('click', () => this.hooks.onPlay());
    bar.append(play);

    const sidebar = el('div', { class: 'sidebar' });
    sidebar.append(el('div', { class: 'side-title', text: '맵 목록' }));
    sidebar.append(this.mapListEl);
    const mapBtns = el('div', { class: 'btn-col' });
    const addMap = el('button', { class: 'btn', text: '새 맵' });
    addMap.addEventListener('click', () => this.addMap());
    const editMap = el('button', { class: 'btn', text: '맵 설정' });
    editMap.addEventListener('click', () => this.mapSettings());
    const delMap = el('button', { class: 'btn', text: '맵 삭제' });
    delMap.addEventListener('click', () => this.deleteMap());
    mapBtns.append(addMap, editMap, delMap);
    sidebar.append(mapBtns);

    const canvasWrap = el('div', { class: 'canvas-wrap' });
    canvasWrap.append(this.canvas);

    const right = el('div', { class: 'right-panel' });
    right.append(el('div', { class: 'side-title', text: '타일 팔레트' }));
    right.append(this.paletteEl);
    right.append(this.eventPanel);

    const main = el('div', { class: 'editor-main' });
    main.append(sidebar, canvasWrap, right);

    this.root.append(bar, main, this.statusEl);
    this.bindCanvas();
    this.refreshToolbar();
    this.setStatus('맵을 편집하세요. 이벤트 모드에서 빈 칸을 클릭하면 새 이벤트를 만듭니다.');
  }

  private setMode(mode: EditorMode): void {
    this.mode = mode;
    this.selectedEvent = null;
    this.refreshToolbar();
    this.refreshPalette();
    this.refreshEventPanel();
    this.render();
  }

  private refreshToolbar(): void {
    for (const [m, b] of this.modeBtns) b.classList.toggle('active', m === this.mode);
    this.root.querySelectorAll<HTMLButtonElement>('.tool-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === this.tool);
    });
  }

  setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }

  refreshMapList(): void {
    this.mapListEl.textContent = '';
    for (const m of this.project.maps) {
      const item = el('div', {
        class: `map-item${m.id === this.currentMap.id ? ' active' : ''}`,
        text: `${String(m.id).padStart(3, '0')} ${m.name} (${m.width}x${m.height})`,
      });
      item.addEventListener('click', () => {
        this.currentMap = m;
        this.selectedEvent = null;
        this.refreshMapList();
        this.refreshEventPanel();
        this.resizeCanvas();
        this.render();
      });
      this.mapListEl.append(item);
    }
  }

  private refreshPalette(): void {
    this.paletteEl.textContent = '';
    if (this.mode === 'event' || this.mode === 'start') {
      this.paletteEl.append(el('div', {
        class: 'palette-hint',
        text: this.mode === 'event'
          ? '빈 칸 클릭: 새 이벤트 / 이벤트 클릭: 선택·드래그 이동 / 더블클릭: 편집 / Del: 삭제'
          : '클릭한 위치가 플레이어 시작 위치가 됩니다.',
      }));
      return;
    }
    const defs = this.mode === 'lower' ? LOWER_TILES : UPPER_TILES;
    if (this.mode === 'upper') {
      const erase = el('div', { class: `palette-tile erase${this.selectedUpper === 0 ? ' active' : ''}`, text: 'X', title: '지우기' });
      erase.addEventListener('click', () => { this.selectedUpper = 0; this.refreshPalette(); });
      this.paletteEl.append(erase);
    }
    defs.forEach((d, i) => {
      const t = el('div', {
        class: 'palette-tile',
        title: d.name,
      });
      const c = el('canvas', { width: '32', height: '32' });
      const cg = c.getContext('2d')!;
      if (this.mode === 'lower') drawTile(cg, 'lower', i, 0, 0, 32, 0);
      else { cg.fillStyle = '#203040'; cg.fillRect(0, 0, 32, 32); drawTile(cg, 'upper', i, 0, 0, 32, 0); }
      t.append(c);
      const sel = this.mode === 'lower' ? this.selectedLower === i : this.selectedUpper === i + 1;
      if (sel) t.classList.add('active');
      t.addEventListener('click', () => {
        if (this.mode === 'lower') this.selectedLower = i;
        else this.selectedUpper = i + 1;
        this.refreshPalette();
      });
      this.paletteEl.append(t);
    });
  }

  private refreshEventPanel(): void {
    this.eventPanel.textContent = '';
    if (this.mode !== 'event') return;
    this.eventPanel.append(el('div', { class: 'side-title', text: '이벤트' }));
    if (!this.selectedEvent) {
      this.eventPanel.append(el('div', { class: 'palette-hint', text: '선택된 이벤트가 없습니다.' }));
      return;
    }
    const ev = this.selectedEvent;
    this.eventPanel.append(el('div', { class: 'ev-info', text: `${ev.name} (${ev.x}, ${ev.y})` }));
    const row = el('div', { class: 'btn-row' });
    const edit = el('button', { class: 'btn primary', text: '편집' });
    edit.addEventListener('click', () => this.editEvent(ev));
    const del = el('button', { class: 'btn', text: '삭제' });
    del.addEventListener('click', () => this.deleteEvent(ev));
    row.append(edit, del);
    this.eventPanel.append(row);
  }

  private resizeCanvas(): void {
    const s = TILE * this.zoom;
    this.canvas.width = this.currentMap.width * s;
    this.canvas.height = this.currentMap.height * s;
    this.g.imageSmoothingEnabled = false;
  }

  private cellFromMouse(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const s = TILE * this.zoom;
    return {
      x: Math.floor((e.clientX - r.left) / s),
      y: Math.floor((e.clientY - r.top) / s),
    };
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.currentMap.width && y < this.currentMap.height;
  }

  private bindCanvas(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = this.cellFromMouse(e);
      if (!this.inBounds(x, y)) return;
      if (this.mode === 'lower' || this.mode === 'upper') {
        this.painting = true;
        if (this.tool === 'rect') {
          this.rectStart = { x, y };
          this.rectEnd = { x, y };
        } else if (this.tool === 'fill') {
          this.floodFill(x, y);
          this.hooks.onChange();
        } else {
          this.paint(x, y);
        }
        this.render();
      } else if (this.mode === 'event') {
        const ev = this.currentMap.events.find((v) => v.x === x && v.y === y);
        if (ev) {
          this.selectedEvent = ev;
          this.draggingEvent = true;
        } else {
          const created = defaultEvent(nextId(this.currentMap.events), x, y);
          this.currentMap.events.push(created);
          this.selectedEvent = created;
          this.hooks.onChange();
          this.editEvent(created);
        }
        this.refreshEventPanel();
        this.render();
      } else if (this.mode === 'start') {
        this.project.startMapId = this.currentMap.id;
        this.project.startX = x;
        this.project.startY = y;
        this.hooks.onChange();
        this.setStatus(`시작 위치: ${this.currentMap.name} (${x}, ${y})`);
        this.render();
      }
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this.cellFromMouse(e);
      if (this.painting && this.inBounds(x, y)) {
        if (this.tool === 'pencil') { this.paint(x, y); this.render(); }
        else if (this.tool === 'rect' && this.rectStart) { this.rectEnd = { x, y }; this.render(); }
      }
      if (this.draggingEvent && this.selectedEvent && this.inBounds(x, y)) {
        const occupied = this.currentMap.events.some((v) => v !== this.selectedEvent && v.x === x && v.y === y);
        if (!occupied) {
          this.selectedEvent.x = x;
          this.selectedEvent.y = y;
          this.refreshEventPanel();
          this.render();
        }
      }
    });
    const stop = () => {
      if (this.painting && this.tool === 'rect' && this.rectStart && this.rectEnd) {
        this.applyRect();
        this.hooks.onChange();
      }
      if (this.painting && this.tool === 'pencil') this.hooks.onChange();
      if (this.draggingEvent) this.hooks.onChange();
      this.painting = false;
      this.draggingEvent = false;
      this.rectStart = null;
      this.rectEnd = null;
      this.render();
    };
    this.canvas.addEventListener('mouseup', stop);
    this.canvas.addEventListener('mouseleave', stop);
    this.canvas.addEventListener('dblclick', (e) => {
      if (this.mode !== 'event') return;
      const { x, y } = this.cellFromMouse(e);
      const ev = this.currentMap.events.find((v) => v.x === x && v.y === y);
      if (ev) this.editEvent(ev);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' && this.mode === 'event' && this.selectedEvent) {
        if (document.querySelector('.modal-overlay')) return;
        this.deleteEvent(this.selectedEvent);
      }
    });
  }

  private paint(x: number, y: number): void {
    const i = y * this.currentMap.width + x;
    if (this.mode === 'lower') this.currentMap.lower[i] = this.selectedLower;
    else if (this.mode === 'upper') this.currentMap.upper[i] = this.selectedUpper;
  }

  private applyRect(): void {
    if (!this.rectStart || !this.rectEnd) return;
    const x0 = Math.min(this.rectStart.x, this.rectEnd.x);
    const x1 = Math.max(this.rectStart.x, this.rectEnd.x);
    const y0 = Math.min(this.rectStart.y, this.rectEnd.y);
    const y1 = Math.max(this.rectStart.y, this.rectEnd.y);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.paint(x, y);
  }

  private floodFill(x: number, y: number): void {
    const m = this.currentMap;
    const arr = this.mode === 'lower' ? m.lower : m.upper;
    const target = arr[y * m.width + x];
    const repl = this.mode === 'lower' ? this.selectedLower : this.selectedUpper;
    if (target === repl) return;
    const stack = [[x, y]];
    while (stack.length > 0) {
      const [cx, cy] = stack.pop()!;
      if (!this.inBounds(cx, cy)) continue;
      const i = cy * m.width + cx;
      if (arr[i] !== target) continue;
      arr[i] = repl;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  render(): void {
    const m = this.currentMap;
    const s = TILE * this.zoom;
    const g = this.g;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const frame = Math.floor(this.animFrame / 2) % 2;
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const i = y * m.width + x;
        drawTile(g, 'lower', m.lower[i], x * s, y * s, s, frame);
      }
    }
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        const v = m.upper[y * m.width + x];
        if (v > 0) drawTile(g, 'upper', v - 1, x * s, y * s, s, frame);
      }
    }
    for (const ev of m.events) {
      const p = ev.pages[0];
      const gr = p?.graphic;
      if (gr && gr.kind === 'char') drawChar(g, gr.index, gr.dir, 0, ev.x * s, ev.y * s, s);
      else if (gr && gr.kind === 'tile') drawTile(g, 'upper', gr.index, ev.x * s, ev.y * s, s, 0);
      if (this.mode === 'event') {
        g.strokeStyle = ev === this.selectedEvent ? '#ffd040' : 'rgba(255,255,255,0.8)';
        g.lineWidth = ev === this.selectedEvent ? 3 : 1.5;
        g.strokeRect(ev.x * s + 1, ev.y * s + 1, s - 2, s - 2);
        if (!gr || gr.kind === 'none') {
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.fillRect(ev.x * s + 2, ev.y * s + 2, s - 4, s - 4);
          g.fillStyle = '#203040';
          g.font = `${14 * this.zoom}px sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('EV', ev.x * s + s / 2, ev.y * s + s / 2);
        }
      }
    }
    if (this.project.startMapId === m.id) {
      g.strokeStyle = '#40ff80';
      g.lineWidth = 3;
      g.strokeRect(this.project.startX * s + 2, this.project.startY * s + 2, s - 4, s - 4);
      g.fillStyle = '#40ff80';
      g.font = `bold ${12 * this.zoom}px sans-serif`;
      g.textAlign = 'center';
      g.fillText('S', this.project.startX * s + s / 2, this.project.startY * s + s / 2);
    }
    if (this.mode === 'event' || this.mode === 'start') {
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      g.lineWidth = 1;
      for (let x = 0; x <= m.width; x++) {
        g.beginPath(); g.moveTo(x * s, 0); g.lineTo(x * s, m.height * s); g.stroke();
      }
      for (let y = 0; y <= m.height; y++) {
        g.beginPath(); g.moveTo(0, y * s); g.lineTo(m.width * s, y * s); g.stroke();
      }
    }
    if (this.painting && this.tool === 'rect' && this.rectStart && this.rectEnd) {
      const x0 = Math.min(this.rectStart.x, this.rectEnd.x) * s;
      const y0 = Math.min(this.rectStart.y, this.rectEnd.y) * s;
      const w = (Math.abs(this.rectEnd.x - this.rectStart.x) + 1) * s;
      const h = (Math.abs(this.rectEnd.y - this.rectStart.y) + 1) * s;
      g.strokeStyle = '#ffd040';
      g.lineWidth = 2;
      g.strokeRect(x0, y0, w, h);
    }
  }

  private editEvent(ev: GameEvent): void {
    openEventEditor(this.project, this.currentMap, ev, () => {
      this.hooks.onChange();
      this.refreshEventPanel();
      this.render();
    });
  }

  private async deleteEvent(ev: GameEvent): Promise<void> {
    if (!(await confirmDialog(`이벤트 "${ev.name}"을(를) 삭제할까요?`))) return;
    const i = this.currentMap.events.indexOf(ev);
    if (i >= 0) this.currentMap.events.splice(i, 1);
    this.selectedEvent = null;
    this.hooks.onChange();
    this.refreshEventPanel();
    this.render();
  }

  private addMap(): void {
    const m = createMap(nextId(this.project.maps), `새 맵 ${nextId(this.project.maps)}`, 25, 18);
    this.project.maps.push(m);
    this.currentMap = m;
    this.hooks.onChange();
    this.refreshMapList();
    this.resizeCanvas();
    this.render();
    this.mapSettings();
  }

  private mapSettings(): void {
    const m = this.currentMap;
    const modal = showModal(`맵 설정 - ${m.name}`, 420);
    const nameI = el('input', { type: 'text', value: m.name });
    const wI = numberInput(m.width, 10, 100);
    const hI = numberInput(m.height, 10, 100);
    const encI = numberInput(m.encounterRate, 0, 999);
    const troopsBox = el('div', { class: 'check-list' });
    for (const t of this.project.troops) {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = m.troopIds.includes(t.id);
      cb.addEventListener('change', () => {
        if (cb.checked) m.troopIds.push(t.id);
        else m.troopIds = m.troopIds.filter((x) => x !== t.id);
      });
      const l = el('label', { class: 'check-item' });
      l.append(cb, el('span', { text: t.name }));
      troopsBox.append(l);
    }
    modal.body.append(
      labeled('맵 이름', nameI),
      labeled('너비 (10-100)', wI),
      labeled('높이 (10-100)', hI),
      labeled('인카운터 (평균 걸음, 0=없음)', encI),
      el('div', { class: 'side-title', text: '출현 부대' }),
      troopsBox,
    );
    const row = el('div', { class: 'btn-row' });
    const ok = el('button', { class: 'btn primary', text: '적용' });
    ok.addEventListener('click', () => {
      m.name = nameI.value || m.name;
      const nw = Math.max(10, Math.min(100, Number(wI.value) || m.width));
      const nh = Math.max(10, Math.min(100, Number(hI.value) || m.height));
      if (nw !== m.width || nh !== m.height) this.resizeMap(m, nw, nh);
      m.encounterRate = Math.max(0, Number(encI.value) || 0);
      this.hooks.onChange();
      this.refreshMapList();
      this.resizeCanvas();
      this.render();
      modal.close();
    });
    row.append(ok);
    modal.body.append(row);
  }

  private resizeMap(m: GameMap, nw: number, nh: number): void {
    const lower = new Array(nw * nh).fill(0);
    const upper = new Array(nw * nh).fill(0);
    for (let y = 0; y < Math.min(m.height, nh); y++) {
      for (let x = 0; x < Math.min(m.width, nw); x++) {
        lower[y * nw + x] = m.lower[y * m.width + x];
        upper[y * nw + x] = m.upper[y * m.width + x];
      }
    }
    m.width = nw; m.height = nh; m.lower = lower; m.upper = upper;
    m.events = m.events.filter((e) => e.x < nw && e.y < nh);
  }

  private async deleteMap(): Promise<void> {
    if (this.project.maps.length <= 1) {
      this.setStatus('마지막 맵은 삭제할 수 없습니다.');
      return;
    }
    const m = this.currentMap;
    if (!(await confirmDialog(`맵 "${m.name}"을(를) 삭제할까요?`))) return;
    this.project.maps = this.project.maps.filter((x) => x.id !== m.id);
    this.currentMap = this.project.maps[0];
    if (this.project.startMapId === m.id) {
      this.project.startMapId = this.currentMap.id;
      this.project.startX = 1;
      this.project.startY = 1;
    }
    this.hooks.onChange();
    this.refreshMapList();
    this.resizeCanvas();
    this.render();
  }

  currentMapName(): string {
    return byId(this.project.maps, this.currentMap.id)?.name ?? '';
  }
}
