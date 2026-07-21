import './style.css';
import type { Project } from './model/types';
import { exampleProject, newProject } from './model/factory';
import { autosaveProject, loadAutosave, downloadProject, pickProjectFile } from './model/storage';
import { Editor } from './editor/editor';
import { Engine } from './runtime/engine';
import { confirmDialog } from './editor/dom';

const app = document.getElementById('app')!;
let gameRoot: HTMLElement | null = null;

function mount(project: Project): void {
  app.textContent = '';
  const editor = new Editor(project, {
    onChange: () => autosaveProject(project),
    onPlay: () => startPlay(editor),
    onNewProject: () => {
      void confirmDialog('현재 프로젝트를 닫고 새 프로젝트를 만들까요?').then((ok) => {
        if (ok) mount(newProject());
      });
    },
    onExampleProject: () => {
      void confirmDialog('현재 프로젝트를 닫고 예제 프로젝트를 열까요?').then((ok) => {
        if (ok) mount(exampleProject());
      });
    },
    onLoadProject: () => {
      void pickProjectFile().then((p) => { if (p) mount(p); });
    },
    onSaveProject: () => downloadProject(project),
  });
  app.append(editor.root);
}

function startPlay(editor: Editor): void {
  autosaveProject(editor.project);
  editor.root.style.display = 'none';
  gameRoot = document.createElement('div');
  gameRoot.className = 'game-root';
  app.append(gameRoot);
  const win = window as unknown as { __engine?: Engine };
  const engine = new Engine(editor.project, gameRoot, () => {
    delete win.__engine;
    gameRoot?.remove();
    gameRoot = null;
    editor.root.style.display = '';
    editor.setStatus('테스트 플레이를 종료했습니다.');
    editor.render();
  });
  win.__engine = engine;
  engine.start();
}

mount(loadAutosave() ?? exampleProject());
