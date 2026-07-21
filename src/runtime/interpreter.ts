import { Project, SaveState, Command, IfCond, byId } from '../model/types';

export class GameOverSignal extends Error {
  constructor() { super('gameover'); }
}

export interface RuntimeOps {
  message(lines: string[]): Promise<void>;
  choices(labels: string[]): Promise<number>;
  toast(text: string): void;
  transfer(mapId: number, x: number, y: number): Promise<void>;
  shop(shopId: number): Promise<void>;
  battle(troopId: number, canEscape: boolean): Promise<'win' | 'escape' | 'lose'>;
  heal(): void;
  waitFrames(n: number): Promise<void>;
  afterStateChange(): void;
}

export class Interpreter {
  constructor(
    private project: Project,
    private state: SaveState,
    private ops: RuntimeOps,
  ) {}

  evalCond(c: IfCond): boolean {
    switch (c.kind) {
      case 'switch': return !!this.state.switches[c.id - 1] === c.on;
      case 'variable': {
        const v = this.state.variables[c.id - 1] ?? 0;
        if (c.cmp === '>=') return v >= c.value;
        if (c.cmp === '==') return v === c.value;
        return v <= c.value;
      }
      case 'quest': {
        const st = this.state.quests[c.id];
        if (c.state === 'notstarted') return st === undefined;
        return st === c.state;
      }
      case 'item': return (this.state.items[c.id] ?? 0) > 0;
      case 'gold': return this.state.gold >= c.value;
    }
  }

  private subst(text: string): string {
    return text.replace(/\\V\[(\d+)\]/g, (_, n) => String(this.state.variables[Number(n) - 1] ?? 0));
  }

  async run(commands: Command[]): Promise<void> {
    for (const cmd of commands) {
      await this.exec(cmd);
    }
  }

  private async exec(cmd: Command): Promise<void> {
    const s = this.state;
    switch (cmd.t) {
      case 'text':
        await this.ops.message(cmd.lines.map((l) => this.subst(l)));
        break;
      case 'choices': {
        const idx = await this.ops.choices(cmd.options.map((o) => o.label));
        await this.run(cmd.options[idx]?.commands ?? []);
        break;
      }
      case 'switch':
        s.switches[cmd.id - 1] = cmd.op === 'on';
        this.ops.afterStateChange();
        break;
      case 'variable': {
        const v = cmd.valueIsVar ? (s.variables[cmd.value - 1] ?? 0) : cmd.value;
        const cur = s.variables[cmd.id - 1] ?? 0;
        if (cmd.op === 'set') s.variables[cmd.id - 1] = v;
        else if (cmd.op === 'add') s.variables[cmd.id - 1] = cur + v;
        else if (cmd.op === 'sub') s.variables[cmd.id - 1] = Math.max(0, cur - v);
        else s.variables[cmd.id - 1] = Math.floor(Math.random() * (v + 1));
        this.ops.afterStateChange();
        break;
      }
      case 'if':
        await this.run(this.evalCond(cmd.cond) ? cmd.then : cmd.else);
        break;
      case 'transfer':
        await this.ops.transfer(cmd.mapId, cmd.x, cmd.y);
        break;
      case 'shop':
        await this.ops.shop(cmd.shopId);
        break;
      case 'quest': {
        const q = byId(this.project.quests, cmd.id);
        if (q) {
          if (cmd.op === 'start') {
            if (s.quests[cmd.id] !== 'done') s.quests[cmd.id] = 'active';
            this.ops.toast(`퀘스트 시작: ${q.name}`);
          } else {
            s.quests[cmd.id] = 'done';
            this.ops.toast(`퀘스트 완료: ${q.name}`);
          }
          this.ops.afterStateChange();
        }
        break;
      }
      case 'item': {
        const it = byId(this.project.items, cmd.id);
        const cur2 = s.items[cmd.id] ?? 0;
        s.items[cmd.id] = Math.max(0, cur2 + cmd.count);
        if (it) this.ops.toast(`${it.name} ${cmd.count >= 0 ? '+' : ''}${cmd.count}`);
        this.ops.afterStateChange();
        break;
      }
      case 'gold':
        s.gold = Math.max(0, s.gold + cmd.amount);
        this.ops.afterStateChange();
        break;
      case 'battle': {
        const result = await this.ops.battle(cmd.troopId, cmd.canEscape);
        this.ops.afterStateChange();
        if (result === 'lose') throw new GameOverSignal();
        break;
      }
      case 'heal':
        this.ops.heal();
        break;
      case 'wait':
        await this.ops.waitFrames(cmd.frames);
        break;
    }
  }
}
