import {
  Project, SaveState, GameMap, GameEvent, EventPage, PageConditions,
  TILE, byId, initialState,
} from '../model/types';
import { drawTile, tilePassable } from '../gfx/tiles';
import { drawChar } from '../gfx/chars';
import { el } from '../editor/dom';
import { Interpreter, RuntimeOps, GameOverSignal } from './interpreter';
import { UI } from './screens';
import { runBattle } from './battle';
import { maxHp } from './stats';

export const VIEW_W = 640;
export const VIEW_H = 480;
const SPEED = 135;
const DX = [0, -1, 1, 0];
const DY = [1, 0, 0, -1];
const KEY_DIRS: Record<string, number> = {
  ArrowDown: 0, ArrowLeft: 1, ArrowRight: 2, ArrowUp: 3,
  s: 0, a: 1, d: 2, w: 3, S: 0, A: 1, D: 2, W: 3,
};

interface EventInst {
  def: GameEvent;
  page: EventPage | null;
  x: number; y: number; dir: number;
  px: number; py: number;
  tx: number; ty: number;
  moving: boolean;
  animT: number;
  moveCooldown: number;
  running: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class Engine {
  project: Project;
  state: SaveState;
  container: HTMLElement;
  onExit: () => void;

  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private ui: UI;
  private interpreter: Interpreter;
  private ops: RuntimeOps;
  private fadeEl: HTMLElement;

  private player = { x: 0, y: 0, dir: 0, px: 0, py: 0, tx: 0, ty: 0, moving: false, animT: 0 };
  private events: EventInst[] = [];
  private keyStack: string[] = [];
  private running = false;
  private battleActive = false;
  private fading = false;
  private blockingRuns = 0;
  private time = 0;
  private last = 0;
  private raf = 0;
  private keyDownFn: (e: KeyboardEvent) => void;
  private keyUpFn: (e: KeyboardEvent) => void;

  constructor(project: Project, container: HTMLElement, onExit: () => void) {
    this.project = project;
    this.container = container;
    this.onExit = onExit;
    this.state = initialState(project);
    this.canvas = el('canvas', { width: String(VIEW_W), height: String(VIEW_H), class: 'game-canvas' });
    this.g = this.canvas.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.ui = new UI(container);
    this.fadeEl = el('div', { class: 'game-fade' });
    this.ops = {
      message: (lines) => this.ui.message(lines),
      choices: (labels) => this.ui.choices(labels),
      toast: (t) => this.ui.toast(t),
      transfer: (m, x, y) => this.transfer(m, x, y),
      shop: (id) => {
        const shop = byId(this.project.shops, id);
        return shop ? this.ui.shop(shop, this.project, this.state) : Promise.resolve();
      },
      battle: (troopId, canEscape) => this.startBattle(troopId, canEscape),
      heal: () => { this.state.party.hp = maxHp(this.project, this.state); },
      waitFrames: (n) => delay((n * 1000) / 60),
      afterStateChange: () => this.resolvePages(),
    };
    this.interpreter = new Interpreter(project, this.state, this.ops);
    this.keyDownFn = (e) => this.onKeyDown(e);
    this.keyUpFn = (e) => this.onKeyUp(e);
  }

  start(state?: SaveState): void {
    if (state) {
      this.state = state;
      this.interpreter = new Interpreter(this.project, this.state, this.ops);
    }
    this.container.textContent = '';
    this.container.append(this.canvas, this.fadeEl);
    this.loadMap(this.state.mapId, this.state.x, this.state.y, this.state.dir);
    document.addEventListener('keydown', this.keyDownFn);
    document.addEventListener('keyup', this.keyUpFn);
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this.keyDownFn);
    document.removeEventListener('keyup', this.keyUpFn);
    this.ui.destroy();
  }

  private map(): GameMap {
    return byId(this.project.maps, this.state.mapId) ?? this.project.maps[0];
  }

  private loadMap(mapId: number, x: number, y: number, dir: number): void {
    this.state.mapId = mapId;
    this.state.x = x; this.state.y = y; this.state.dir = dir;
    this.player.x = x; this.player.y = y; this.player.dir = dir;
    this.player.px = x * TILE; this.player.py = y * TILE;
    this.player.tx = x; this.player.ty = y;
    this.player.moving = false;
    this.events = this.map().events.map((def) => ({
      def, page: null,
      x: def.x, y: def.y, dir: 0,
      px: def.x * TILE, py: def.y * TILE,
      tx: def.x, ty: def.y,
      moving: false, animT: 0,
      moveCooldown: 500 + Math.random() * 1000,
      running: false,
    }));
    this.resolvePages();
  }

  private condMet(c: PageConditions): boolean {
    const s = this.state;
    if (c.switch1On && !s.switches[c.switch1Id - 1]) return false;
    if (c.switch2On && !s.switches[c.switch2Id - 1]) return false;
    if (c.variableOn && (s.variables[c.variableId - 1] ?? 0) < c.variableValue) return false;
    if (c.questOn && s.quests[c.questId] !== c.questState) return false;
    return true;
  }

  private resolvePages(): void {
    for (const inst of this.events) {
      let found: EventPage | null = null;
      for (const p of inst.def.pages) {
        if (this.condMet(p.conditions)) found = p;
      }
      if (found !== inst.page) {
        inst.page = found;
        inst.dir = found?.graphic.dir ?? 0;
      }
    }
  }

  private blocked(): boolean {
    return this.ui.isOpen() || this.blockingRuns > 0 || this.battleActive || this.fading;
  }

  private solidAt(x: number, y: number): EventInst | undefined {
    return this.events.find((e) => e.page && e.page.graphic.kind !== 'none' && e.tx === x && e.ty === y);
  }

  private passable(x: number, y: number, forPlayer: boolean): boolean {
    const m = this.map();
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) return false;
    if (!tilePassable('lower', m.lower[y * m.width + x])) return false;
    const up = m.upper[y * m.width + x];
    if (up > 0 && !tilePassable('upper', up - 1)) return false;
    if (this.solidAt(x, y)) return false;
    if (!forPlayer && this.player.tx === x && this.player.ty === y) return false;
    if (forPlayer && this.events.some((e) => e.tx === x && e.ty === y && e.moving)) return false;
    return true;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key in KEY_DIRS || ['z', 'Z', 'x', 'X', 'Enter', ' ', 'Escape'].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key in KEY_DIRS) {
      if (!this.keyStack.includes(e.key)) this.keyStack.push(e.key);
      return;
    }
    if (e.repeat || this.blocked() || this.player.moving) return;
    if (['z', 'Z', 'Enter', ' '].includes(e.key)) this.tryAction();
    else if (['x', 'X', 'Escape'].includes(e.key)) void this.openMenu();
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keyStack = this.keyStack.filter((k) => k !== e.key);
  }

  private tryAction(): void {
    const nx = this.player.x + DX[this.player.dir];
    const ny = this.player.y + DY[this.player.dir];
    const inst = this.events.find((e) => e.tx === nx && e.ty === ny && e.page && e.page.trigger === 'action' && e.page.commands.length > 0);
    if (inst) {
      inst.dir = [3, 2, 1, 0][this.player.dir];
      void this.runEvent(inst, true);
    }
  }

  private async openMenu(): Promise<void> {
    const result = await this.ui.menu(this.project, this.state, {
      onLoad: (loaded) => {
        this.state = loaded;
        this.interpreter = new Interpreter(this.project, this.state, this.ops);
        this.loadMap(loaded.mapId, loaded.x, loaded.y, loaded.dir);
      },
    });
    if (result === 'exit') {
      this.stop();
      this.onExit();
    }
  }

  private async runEvent(inst: EventInst, blocking: boolean): Promise<void> {
    if (inst.running || !inst.page) return;
    inst.running = true;
    if (blocking) this.blockingRuns++;
    try {
      await this.interpreter.run(inst.page.commands);
    } catch (err) {
      if (!(err instanceof GameOverSignal)) throw err;
    } finally {
      inst.running = false;
      if (blocking) this.blockingRuns--;
    }
  }

  private async transfer(mapId: number, x: number, y: number): Promise<void> {
    this.fading = true;
    this.fadeEl.classList.add('on');
    await delay(320);
    this.loadMap(mapId, x, y, this.player.dir);
    await delay(80);
    this.fadeEl.classList.remove('on');
    await delay(320);
    this.fading = false;
  }

  private async startBattle(troopId: number, canEscape: boolean): Promise<'win' | 'escape' | 'lose'> {
    const troop = byId(this.project.troops, troopId);
    if (!troop) return 'win';
    this.blockingRuns++;
    this.battleActive = true;
    const result = await runBattle(this.project, this.state, troop, canEscape, this.ui, this.g, VIEW_W, VIEW_H);
    this.battleActive = false;
    this.blockingRuns--;
    if (result === 'lose') {
      await this.ui.gameOver();
      this.stop();
      this.onExit();
    }
    return result;
  }

  private onStep(): void {
    const m = this.map();
    for (const inst of this.events) {
      if (inst.tx === this.player.x && inst.ty === this.player.y && inst.page?.trigger === 'touch' && inst.page.commands.length > 0) {
        void this.runEvent(inst, true);
        return;
      }
    }
    if (m.encounterRate > 0 && m.troopIds.length > 0 && Math.random() < 1 / m.encounterRate) {
      const troopId = m.troopIds[Math.floor(Math.random() * m.troopIds.length)];
      void this.startBattle(troopId, true);
    }
  }

  private loop(t: number): void {
    if (!this.running) return;
    const dt = Math.min(60, t - this.last);
    this.last = t;
    if (!this.battleActive) {
      this.time += dt;
      this.update(dt);
      this.render();
    }
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
  }

  private advanceMover(
    o: { px: number; py: number; tx: number; ty: number; moving: boolean; x: number; y: number; animT: number },
    dt: number,
  ): boolean {
    const targetX = o.tx * TILE;
    const targetY = o.ty * TILE;
    const dx = targetX - o.px;
    const dy = targetY - o.py;
    const dist = Math.hypot(dx, dy);
    const step = (SPEED * dt) / 1000;
    o.animT += dt;
    if (dist <= step) {
      o.px = targetX; o.py = targetY;
      o.x = o.tx; o.y = o.ty;
      o.moving = false;
      return true;
    }
    o.px += (dx / dist) * step;
    o.py += (dy / dist) * step;
    return false;
  }

  private update(dt: number): void {
    for (const inst of this.events) {
      if (!inst.page) continue;
      if (inst.moving) {
        this.advanceMover(inst, dt);
        continue;
      }
      if (inst.page.moveType === 'random' && !this.blocked()) {
        inst.moveCooldown -= dt;
        if (inst.moveCooldown <= 0) {
          inst.moveCooldown = 600 + Math.random() * 1200;
          const d = Math.floor(Math.random() * 4);
          const nx = inst.x + DX[d];
          const ny = inst.y + DY[d];
          inst.dir = d;
          if (this.passable(nx, ny, false)) {
            inst.tx = nx; inst.ty = ny;
            inst.moving = true;
          }
        }
      }
    }

    if (!this.blocked()) {
      for (const inst of this.events) {
        if (!inst.page || inst.running || inst.page.commands.length === 0) continue;
        if (inst.page.trigger === 'auto') void this.runEvent(inst, true);
        else if (inst.page.trigger === 'parallel') void this.runEvent(inst, false);
      }
    }

    if (this.blocked()) return;

    const pl = this.player;
    if (pl.moving) {
      if (this.advanceMover(pl, dt)) this.onStep();
      return;
    }
    const lastKey = [...this.keyStack].reverse().find((k) => k in KEY_DIRS);
    if (lastKey !== undefined) {
      const d = KEY_DIRS[lastKey];
      pl.dir = d;
      const nx = pl.x + DX[d];
      const ny = pl.y + DY[d];
      if (this.passable(nx, ny, true)) {
        pl.tx = nx; pl.ty = ny;
        pl.moving = true;
      }
    }
  }

  private render(): void {
    const g = this.g;
    const m = this.map();
    const mapW = m.width * TILE;
    const mapH = m.height * TILE;
    const camX = mapW <= VIEW_W ? (mapW - VIEW_W) / 2 : Math.max(0, Math.min(mapW - VIEW_W, this.player.px + TILE / 2 - VIEW_W / 2));
    const camY = mapH <= VIEW_H ? (mapH - VIEW_H) / 2 : Math.max(0, Math.min(mapH - VIEW_H, this.player.py + TILE / 2 - VIEW_H / 2));
    g.fillStyle = '#101018';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const frame = Math.floor(this.time / 400) % 2;
    const x0 = Math.max(0, Math.floor(camX / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(m.width - 1, Math.ceil((camX + VIEW_W) / TILE));
    const y1 = Math.min(m.height - 1, Math.ceil((camY + VIEW_H) / TILE));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        drawTile(g, 'lower', m.lower[y * m.width + x], x * TILE - camX, y * TILE - camY, TILE, frame);
      }
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const v = m.upper[y * m.width + x];
        if (v > 0) drawTile(g, 'upper', v - 1, x * TILE - camX, y * TILE - camY, TILE, frame);
      }
    }
    const drawables: { py: number; draw: () => void }[] = [];
    for (const inst of this.events) {
      if (!inst.page) continue;
      const gr = inst.page.graphic;
      if (gr.kind === 'none') continue;
      const fr = inst.moving ? Math.floor(inst.animT / 150) % 2 : 0;
      drawables.push({
        py: inst.py,
        draw: () => {
          if (gr.kind === 'char') drawChar(g, gr.index, inst.dir, fr, inst.px - camX, inst.py - camY, TILE);
          else drawTile(g, 'upper', gr.index, inst.px - camX, inst.py - camY, TILE, frame);
        },
      });
    }
    const plFrame = this.player.moving ? Math.floor(this.player.animT / 150) % 2 : 0;
    const sprite = this.project.actors[0]?.sprite ?? 0;
    drawables.push({
      py: this.player.py,
      draw: () => drawChar(g, sprite, this.player.dir, plFrame, this.player.px - camX, this.player.py - camY, TILE),
    });
    drawables.sort((a, b) => a.py - b.py);
    for (const d of drawables) d.draw();
    g.fillStyle = 'rgba(8,16,48,0.75)';
    g.fillRect(6, 6, 190, 26);
    g.strokeStyle = '#e8e8f0';
    g.lineWidth = 1.5;
    g.strokeRect(6, 6, 190, 26);
    g.fillStyle = '#fff';
    g.font = '14px "Malgun Gothic", sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(`${m.name}   ${this.state.gold}G`, 14, 20);
  }
}
