
import { EXT_CLASS, PROCESSED_ATTR, qs, qsa, throttle, downloadTextFile } from "./helpers/util";
import { toDelimited } from "./helpers/csv";

export type Delimiter = "," | "\t" | ";" | "|" | "custom";

export interface TableState {
  selectedRows: Set<number>;
  selectedCols: Set<number>;
  lastRowClickIndex: number | null;
  refreshRowCheckboxes: () => void;
  selectAllRows: () => void;
  selectAllCols: () => void;
}

export interface GatherOptions {
  includeHeader: boolean;
}

export function detectSimpleTable(table: HTMLTableElement): boolean {
  const rows = Array.from(table.rows);
  for (const r of rows) {
    for (const cell of Array.from(r.cells)) {
      if (cell.colSpan > 1 || cell.rowSpan > 1) {
        //   console.debug('[TPE] Skipped: complex spans', table);
        return false;
      }
    }
  }
  return rows.length > 0 && rows[0].cells.length > 0;
}

export function buildToolbar(): HTMLDivElement {
  const toolbar = document.createElement("div");
  toolbar.className = `${EXT_CLASS}-toolbar`;
  toolbar.innerHTML = `
    <div class="${EXT_CLASS}-toolbar-row">
      <label>Delimiter:
        <select class="${EXT_CLASS}-delimiter">
          <option value="," selected>Comma (,)</option>
          <option value="\t">Tab (TSV)</option>
          <option value=";">Semicolon (;)</option>
          <option value="|">Pipe (|)</option>
          <option value="custom">Custom…</option>
        </select>
      </label>
      <input class="${EXT_CLASS}-custom-delim" placeholder="Custom delimiter" style="display:none" />
      <label class="${EXT_CLASS}-checkbox"><input type="checkbox" class="${EXT_CLASS}-include-headers" checked> Include header row</label>
      <label class="${EXT_CLASS}-checkbox"><input type="checkbox" class="${EXT_CLASS}-always-quote"> Always quote cells</label>
      <button class="${EXT_CLASS}-copy">Copy</button>
      <button class="${EXT_CLASS}-select-all">Select all</button>
      <button class="${EXT_CLASS}-clear">Clear selection</button>
      <button class="${EXT_CLASS}-download">Download</button>
    </div>
    <div class="${EXT_CLASS}-hint">Tip: Use the header checkboxes to pick columns, and the left edge to pick rows. Shift-click a row checkbox to select a range.</div>
  `;

  const delimSelect = qs<HTMLSelectElement>(toolbar, `.${EXT_CLASS}-delimiter`)!;
  const customInput = qs<HTMLInputElement>(toolbar, `.${EXT_CLASS}-custom-delim`)!;
  delimSelect.addEventListener("change", () => {
    customInput.style.display = delimSelect.value === "custom" ? "" : "none";
  });

  return toolbar;
}

export function injectSelectors(table: HTMLTableElement, state: TableState): void {
  if (!table.tHead) {
    const thead = table.createTHead();
    const firstRow = table.rows[0];
    if (firstRow) thead.appendChild(firstRow);
  }
  if (!table.tBodies || table.tBodies.length === 0) {
    const tbody = document.createElement("tbody");
    while (table.rows.length > 1) tbody.appendChild(table.rows[1]!);
    table.appendChild(tbody);
  }

  const headRow = table.tHead!.rows[0]!;
  const colCount = headRow ? headRow.cells.length : (table.rows[0]?.cells.length ?? 0);

  // Left header select cell
  const leftTh = document.createElement("th");
  leftTh.className = `${EXT_CLASS}-row-select-th`;
  leftTh.title = "Select all rows";

  const allRowsCb = document.createElement("input");
  allRowsCb.type = "checkbox";
  allRowsCb.addEventListener("change", () => {
    state.selectedRows.clear();
    if (allRowsCb.checked) {
      for (let i = 0; i < table.tBodies[0]!.rows.length; i++) state.selectedRows.add(i);
    }
    state.refreshRowCheckboxes();
  });
  leftTh.appendChild(allRowsCb);
  headRow.insertBefore(leftTh, headRow.cells[0] || null);

  function refreshRowCheckboxes() {
    Array.from(table.tBodies[0]!.rows).forEach((tr, idx) => {
      let cbCell = tr.querySelector<HTMLElement>(`th.${EXT_CLASS}-row-select, td.${EXT_CLASS}-row-select`);
      if (!cbCell) {
        const td = document.createElement("td");
        td.className = `${EXT_CLASS}-row-select`;

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.addEventListener("click", (e: MouseEvent) => {
          const rowIndex = idx;
          if ((e as MouseEvent).shiftKey && state.lastRowClickIndex != null) {
            const [a, b] = [state.lastRowClickIndex, rowIndex].sort((x, y) => x - y);
            for (let i = a; i <= b; i++) state.selectedRows.add(i);
          } else {
            if (state.selectedRows.has(rowIndex)) state.selectedRows.delete(rowIndex);
            else state.selectedRows.add(rowIndex);
            state.lastRowClickIndex = rowIndex;
          }
          allRowsCb.checked = state.selectedRows.size === table.tBodies[0]!.rows.length;
        });

        td.appendChild(cb);
        tr.insertBefore(td, tr.cells[0] || null);
      } else {
        const cb = cbCell.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
        cb.checked = state.selectedRows.has(idx);
      }
    });
  }
  refreshRowCheckboxes();
  state.refreshRowCheckboxes = refreshRowCheckboxes;

  // Header column checkboxes (offset +1 due to left select col)
  for (let c = 0; c < colCount; c++) {
    const th = headRow.cells[c + 1]!;
    const wrapper = document.createElement("div");
    wrapper.className = `${EXT_CLASS}-col-header`;

    const titleSpan = document.createElement("span");
    titleSpan.textContent = (th.textContent ?? "").trim() || `Col ${c + 1}`;
    titleSpan.className = `${EXT_CLASS}-col-title`;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = `${EXT_CLASS}-col-cb`;
    cb.title = "Select column";
    cb.addEventListener("change", () => {
      if (cb.checked) state.selectedCols.add(c);
      else state.selectedCols.delete(c);
    });

    wrapper.append(cb, titleSpan);
    if (th) {
      th.textContent = "";
      th.appendChild(wrapper);
    }
  }

  // NEW: expose select-all helpers
  state.selectAllRows = () => {
    const total = table.tBodies[0].rows.length;
    state.selectedRows.clear();
    for (let i = 0; i < total; i++) state.selectedRows.add(i);
    allRowsCb.checked = true;
    state.refreshRowCheckboxes();
  };

  state.selectAllCols = () => {
    const allColsCount = table.tHead!.rows[0].cells.length - 1; // minus the row-select column
    state.selectedCols = new Set(Array.from({ length: allColsCount }, (_, i) => i));
    qsa<HTMLInputElement>(table, `.${EXT_CLASS}-col-cb`).forEach((cb) => (cb.checked = true));
  };
}

export function gatherData(table: HTMLTableElement, state: TableState, options: { includeHeader: boolean }): string[][] {
  const tbody = table.tBodies[0]!;
  const rows = Array.from(tbody.rows);
  const { includeHeader } = options;

  const selectedRows = state.selectedRows.size
    ? rows.filter((_, i) => state.selectedRows.has(i))
    : rows;

  const allColsCount = table.tHead!.rows[0]!.cells.length - 1; // minus the added left select column
  const selectedCols = state.selectedCols.size
    ? Array.from(state.selectedCols).sort((a, b) => a - b)
    : Array.from({ length: allColsCount }, (_, i) => i);

  const readCell = (tr: HTMLTableRowElement, colIdx: number) => tr.cells[colIdx + 1]?.innerText ?? "";

  const matrix: string[][] = [];
  if (includeHeader && table.tHead && table.tHead.rows.length) {
    const headerRow: string[] = [];
    for (const c of selectedCols) {
      headerRow.push(table.tHead.rows[0]!.cells[c + 1]?.innerText ?? "");
    }
    matrix.push(headerRow);
  }

  for (const tr of selectedRows) {
    const row: string[] = [];
    for (const c of selectedCols) row.push(readCell(tr, c));
    matrix.push(row);
  }

  return matrix;
}

export async function onCopyClick(
  table: HTMLTableElement,
  state: TableState,
  delimiter: string,
  includeHeader: boolean,
  alwaysQuote: boolean
): Promise<boolean> {
  const matrix = gatherData(table, state, { includeHeader });
  const text = toDelimited(matrix, delimiter, alwaysQuote);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}

export function onDownloadClick(
  table: HTMLTableElement,
  state: TableState,
  delimiter: string,
  includeHeader: boolean,
  alwaysQuote: boolean
): void {
  const matrix = gatherData(table, state, { includeHeader });
  const text = toDelimited(matrix, delimiter, alwaysQuote);
  const ext = delimiter === "\t" ? "tsv" : "csv";
  downloadTextFile(`table-selection.${ext}`, text);
}

export function attach(table: HTMLTableElement): void {
  if (table.getAttribute(PROCESSED_ATTR)) return;
  if (!detectSimpleTable(table)) return;

  table.setAttribute(PROCESSED_ATTR, "1");
  table.classList.add(`${EXT_CLASS}-table`);

  const state: TableState = {
    selectedRows: new Set(),
    selectedCols: new Set(),
    lastRowClickIndex: null,
    refreshRowCheckboxes: () => { },
    selectAllRows: () => {}, 
    selectAllCols: () => {},  
  };

  injectSelectors(table, state);

  const toolbar = buildToolbar();
  table.insertAdjacentElement("beforebegin", toolbar);

  const copyBtn = qs<HTMLButtonElement>(toolbar, `.${EXT_CLASS}-copy`)!;
  const clearBtn = qs<HTMLButtonElement>(toolbar, `.${EXT_CLASS}-clear`)!;
  const selectAllBtn = qs<HTMLButtonElement>(toolbar, `.${EXT_CLASS}-select-all`)!;
  const downloadBtn = qs<HTMLButtonElement>(toolbar, `.${EXT_CLASS}-download`)!;

  const includeHeadersCb = qs<HTMLInputElement>(toolbar, `.${EXT_CLASS}-include-headers`)!;
  const alwaysQuoteCb = qs<HTMLInputElement>(toolbar, `.${EXT_CLASS}-always-quote`)!;
  const delimSelect = qs<HTMLSelectElement>(toolbar, `.${EXT_CLASS}-delimiter`)!;
  const customInput = qs<HTMLInputElement>(toolbar, `.${EXT_CLASS}-custom-delim`)!;

  copyBtn.addEventListener("click", async () => {
    const raw = delimSelect.value as Delimiter;
    const delimiter = raw === "custom" ? (customInput.value || ",") : raw;
    const ok = await onCopyClick(table, state, delimiter, includeHeadersCb.checked, alwaysQuoteCb.checked);
    copyBtn.textContent = ok ? "Copied!" : "Copy failed";
    window.setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  });

  downloadBtn.addEventListener("click", () => {
    const raw = delimSelect.value as Delimiter;
    const delimiter = raw === "custom" ? (customInput.value || ",") : raw;
    onDownloadClick(table, state, delimiter, includeHeadersCb.checked, alwaysQuoteCb.checked);
  });

  clearBtn.addEventListener("click", () => {
    state.selectedRows.clear();
    state.selectedCols.clear();
    qsa<HTMLInputElement>(table, `.${EXT_CLASS}-col-cb`).forEach(cb => (cb.checked = false));
    state.refreshRowCheckboxes();
  });
    selectAllBtn.addEventListener("click", () => {
    state.selectAllRows();
    state.selectAllCols();
  });
}


function scanShadowRoots(root: ParentNode = document) {
  // Find hosts that already have a shadowRoot
  const hosts = Array.from((root as Document | Element).querySelectorAll<HTMLElement>('*'))
    .filter((el) => (el as any).shadowRoot);

  for (const host of hosts) {
    const sr = (host as any).shadowRoot as ShadowRoot;
    init(sr); // reuse your existing init(root) to attach inside this shadow root
  }
}


export function init(root: ParentNode = document): void {
  const tryAttach = throttle(() => {
    qsa<HTMLTableElement>(root, "table").forEach(attach);
    if (root === document) scanShadowRoots(root); // only scan shadow roots if we're at document level
  }, 400);

  tryAttach();

  const mo = new MutationObserver(tryAttach);
  mo.observe(root as Node, { childList: true, subtree: true });

  window.addEventListener("resize", tryAttach);
}
