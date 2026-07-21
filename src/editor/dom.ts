export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

export interface ModalHandle {
  root: HTMLDivElement;
  body: HTMLDivElement;
  close: () => void;
}

export function showModal(title: string, width = 560): ModalHandle {
  const overlay = el('div', { class: 'modal-overlay' });
  const box = el('div', { class: 'modal-box' });
  box.style.width = `${width}px`;
  const head = el('div', { class: 'modal-head' });
  const titleEl = el('span', { text: title });
  const closeBtn = el('button', { class: 'modal-close', text: 'X' });
  head.append(titleEl, closeBtn);
  const body = el('div', { class: 'modal-body' });
  box.append(head, body);
  overlay.append(box);
  document.body.append(overlay);
  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  return { root: overlay, body, close };
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const m = showModal('확인', 360);
    m.body.append(el('p', { text: message }));
    const row = el('div', { class: 'btn-row' });
    const ok = el('button', { class: 'btn primary', text: '확인' });
    const cancel = el('button', { class: 'btn', text: '취소' });
    ok.addEventListener('click', () => { m.close(); resolve(true); });
    cancel.addEventListener('click', () => { m.close(); resolve(false); });
    row.append(ok, cancel);
    m.body.append(row);
  });
}

export function labeled(label: string, input: HTMLElement): HTMLLabelElement {
  const l = el('label', { class: 'field' });
  l.append(el('span', { text: label }), input);
  return l;
}

export function numberInput(value: number, min = 0, max = 9999): HTMLInputElement {
  const i = el('input', { type: 'number', value: String(value), min: String(min), max: String(max) });
  return i;
}

export function selectInput(options: { value: string; label: string }[], value: string): HTMLSelectElement {
  const s = el('select');
  for (const o of options) {
    const opt = el('option', { value: o.value, text: o.label });
    if (o.value === value) opt.selected = true;
    s.append(opt);
  }
  return s;
}
