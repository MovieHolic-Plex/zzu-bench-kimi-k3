import type { Project, SaveState } from './types';

const AUTOSAVE_KEY = 'rpg2k.project.autosave';

export function autosaveProject(p: Project): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(p));
  } catch {
    return;
  }
}

export function loadAutosave(): Project | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Project;
    if (p && p.version === 1 && Array.isArray(p.maps)) return p;
    return null;
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

export function downloadProject(p: Project): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.name || 'project'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickProjectFile(): Promise<Project | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const p = JSON.parse(String(reader.result)) as Project;
          if (p && p.version === 1 && Array.isArray(p.maps)) resolve(p);
          else { alert('올바른 프로젝트 파일이 아닙니다.'); resolve(null); }
        } catch {
          alert('프로젝트 파일을 읽을 수 없습니다.');
          resolve(null);
        }
      };
      reader.readAsText(f);
    });
    input.click();
  });
}

function slotKey(projectName: string, slot: number): string {
  return `rpg2k.save.${projectName}.${slot}`;
}

export interface SaveSlot { state: SaveState; time: number; }

export function writeSaveSlot(projectName: string, slot: number, state: SaveState): void {
  const data: SaveSlot = { state, time: Date.now() };
  localStorage.setItem(slotKey(projectName, slot), JSON.stringify(data));
}

export function readSaveSlot(projectName: string, slot: number): SaveSlot | null {
  try {
    const raw = localStorage.getItem(slotKey(projectName, slot));
    if (!raw) return null;
    return JSON.parse(raw) as SaveSlot;
  } catch {
    return null;
  }
}

export const SAVE_SLOTS = 3;
