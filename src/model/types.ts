export const TILE = 32;

export type Trigger = 'action' | 'touch' | 'auto' | 'parallel';
export const TRIGGER_NAMES: Record<Trigger, string> = {
  action: '결정 버튼',
  touch: '플레이어 접촉',
  auto: '자동 시작',
  parallel: '병렬 처리',
};

export type QuestState = 'active' | 'done';

export interface PageConditions {
  switch1On: boolean; switch1Id: number;
  switch2On: boolean; switch2Id: number;
  variableOn: boolean; variableId: number; variableValue: number;
  questOn: boolean; questId: number; questState: QuestState;
}

export type GraphicKind = 'none' | 'char' | 'tile';
export interface Graphic {
  kind: GraphicKind;
  index: number;
  dir: number;  
}

export type MoveType = 'none' | 'random';

export type IfCond =
  | { kind: 'switch'; id: number; on: boolean }
  | { kind: 'variable'; id: number; cmp: '>=' | '==' | '<='; value: number }
  | { kind: 'quest'; id: number; state: 'notstarted' | 'active' | 'done' }
  | { kind: 'item'; id: number }
  | { kind: 'gold'; value: number };

export type Command =
  | { t: 'text'; lines: string[] }
  | { t: 'choices'; options: { label: string; commands: Command[] }[] }
  | { t: 'switch'; id: number; op: 'on' | 'off' }
  | { t: 'variable'; id: number; op: 'set' | 'add' | 'sub' | 'rand'; value: number; valueIsVar: boolean }
  | { t: 'if'; cond: IfCond; then: Command[]; else: Command[] }
  | { t: 'transfer'; mapId: number; x: number; y: number }
  | { t: 'shop'; shopId: number }
  | { t: 'quest'; id: number; op: 'start' | 'complete' }
  | { t: 'item'; id: number; count: number }
  | { t: 'gold'; amount: number }           
  | { t: 'battle'; troopId: number; canEscape: boolean }
  | { t: 'heal' }
  | { t: 'wait'; frames: number };

export interface EventPage {
  conditions: PageConditions;
  graphic: Graphic;
  trigger: Trigger;
  moveType: MoveType;
  commands: Command[];
}

export interface GameEvent {
  id: number;
  name: string;
  x: number;
  y: number;
  pages: EventPage[];
}

export interface GameMap {
  id: number;
  name: string;
  width: number;
  height: number;
  lower: number[];
  upper: number[]; // 0 = 없음, 그 외 UPPER_TILES index + 1
  events: GameEvent[];
  encounterRate: number;
  troopIds: number[];
}

export type ItemKind = 'weapon' | 'armor' | 'consumable' | 'key';
export const ITEM_KIND_NAMES: Record<ItemKind, string> = {
  weapon: '무기', armor: '방어구', consumable: '소비', key: '중요',
};
export interface Item {
  id: number; name: string; desc: string; price: number;
  kind: ItemKind; power: number;
}

export interface Actor {
  id: number; name: string;
  maxhp: number; atk: number; def: number;
  weaponId: number; armorId: number; sprite: number;
}

export interface Quest { id: number; name: string; desc: string; }
export interface Shop { id: number; name: string; stock: number[]; }
export interface Monster {
  id: number; name: string;
  hp: number; atk: number; def: number; exp: number; gold: number;
  sprite: number;
}
export interface Troop { id: number; name: string; monsterIds: number[]; }

export interface Project {
  name: string;
  version: 1;
  switches: string[];  
  variables: string[]; 
  maps: GameMap[];
  items: Item[];
  actors: Actor[];
  quests: Quest[];
  shops: Shop[];
  monsters: Monster[];
  troops: Troop[];
  startMapId: number;
  startX: number;
  startY: number;
}

export function byId<T extends { id: number }>(arr: T[], id: number): T | undefined {
  return arr.find((a) => a.id === id);
}
export function nextId(arr: { id: number }[]): number {
  return arr.reduce((m, a) => Math.max(m, a.id), 0) + 1;
}
export function pad4(n: number): string {
  return String(n).padStart(4, '0');
}
export function swName(p: Project, id: number): string {
  return `[${pad4(id)}:${p.switches[id - 1] ?? ''}]`;
}
export function varName(p: Project, id: number): string {
  return `[${pad4(id)}:${p.variables[id - 1] ?? ''}]`;
}

export function defaultConditions(): PageConditions {
  return {
    switch1On: false, switch1Id: 1,
    switch2On: false, switch2Id: 1,
    variableOn: false, variableId: 1, variableValue: 0,
    questOn: false, questId: 1, questState: 'active',
  };
}
export function defaultPage(): EventPage {
  return {
    conditions: defaultConditions(),
    graphic: { kind: 'char', index: 0, dir: 0 },
    trigger: 'action',
    moveType: 'none',
    commands: [],
  };
}
export function defaultEvent(id: number, x: number, y: number): GameEvent {
  return { id, name: `EV${pad4(id)}`, x, y, pages: [defaultPage()] };
}

export function createMap(id: number, name: string, width: number, height: number): GameMap {
  return {
    id, name, width, height,
    lower: new Array(width * height).fill(0),
    upper: new Array(width * height).fill(0),
    events: [],
    encounterRate: 0,
    troopIds: [],
  };
}

export interface PartyState {
  level: number; exp: number; hp: number;
  weaponId: number; armorId: number;
}
export interface SaveState {
  mapId: number; x: number; y: number; dir: number;
  switches: boolean[];
  variables: number[];
  items: Record<number, number>;
  gold: number;
  quests: Record<number, QuestState>;
  party: PartyState;
}
export function initialState(p: Project): SaveState {
  const a = p.actors[0];
  const items: Record<number, number> = {};
  if (a && a.weaponId > 0) items[a.weaponId] = 1;
  if (a && a.armorId > 0) items[a.armorId] = 1;
  return {
    mapId: p.startMapId, x: p.startX, y: p.startY, dir: 0,
    switches: new Array(p.switches.length).fill(false),
    variables: new Array(p.variables.length).fill(0),
    items,
    gold: 100,
    quests: {},
    party: a
      ? { level: 1, exp: 0, hp: a.maxhp, weaponId: a.weaponId, armorId: a.armorId }
      : { level: 1, exp: 0, hp: 50, weaponId: 0, armorId: 0 },
  };
}
