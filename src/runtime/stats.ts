import { Project, SaveState, byId } from '../model/types';

export function maxHp(p: Project, s: SaveState): number {
  const a = p.actors[0];
  return (a?.maxhp ?? 50) + (s.party.level - 1) * 6;
}

export function attack(p: Project, s: SaveState): number {
  const a = p.actors[0];
  const w = byId(p.items, s.party.weaponId);
  return (a?.atk ?? 5) + (s.party.level - 1) * 2 + (w?.kind === 'weapon' ? w.power : 0);
}

export function defense(p: Project, s: SaveState): number {
  const a = p.actors[0];
  const ar = byId(p.items, s.party.armorId);
  return (a?.def ?? 0) + (s.party.level - 1) + (ar?.kind === 'armor' ? ar.power : 0);
}

export function expForNext(s: SaveState): number {
  return s.party.level * 30;
}
