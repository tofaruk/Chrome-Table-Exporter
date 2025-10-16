"use strict";
(() => {
  // src/helpers/util.ts
  var EXT_CLASS = "tpc-ext";
  var PROCESSED_ATTR = "data-tpc-processed";
  var qs = (root, sel) => root.querySelector(sel);
  var qsa = (root, sel) => Array.from(root.querySelectorAll(sel));
  function throttle(fn, wait) {
    let last = 0;
    let timer = null;
    return function(...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        if (timer) window.clearTimeout(timer);
        timer = null;
        last = now;
        fn.apply(this, args);
      } else if (!timer) {
        timer = window.setTimeout(() => {
          last = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }
  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  }

  // src/helpers/csv.ts
  function escapeCell(value, delimiter, quote = '"', alwaysQuote = false) {
    let v = value == null ? "" : String(value);
    v = v.replace(/\r\n|\r|\n/g, "\n");
    const mustQuote = alwaysQuote || v.includes(delimiter) || v.includes(quote) || /\s/.test(delimiter) || /\n/.test(v);
    return mustQuote ? quote + v.replaceAll(quote, quote + quote) + quote : v;
  }
  function toDelimited(matrix, delimiter, alwaysQuote) {
    return matrix.map((r) => r.map((v) => escapeCell(v, delimiter, '"', alwaysQuote)).join(delimiter)).join("\n");
  }

  // src/core.ts
  function detectSimpleTable(table) {
    const rows = Array.from(table.rows);
    for (const r of rows) {
      for (const cell of Array.from(r.cells)) {
        if (cell.colSpan > 1 || cell.rowSpan > 1) return false;
      }
    }
    return rows.length > 0 && rows[0].cells.length > 0;
  }
  function buildToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = `${EXT_CLASS}-toolbar`;
    toolbar.innerHTML = `
    <div class="${EXT_CLASS}-toolbar-row">
      <label>Delimiter:
        <select class="${EXT_CLASS}-delimiter">
          <option value="," selected>Comma (,)</option>
          <option value="	">Tab (TSV)</option>
          <option value=";">Semicolon (;)</option>
          <option value="|">Pipe (|)</option>
          <option value="custom">Custom\u2026</option>
        </select>
      </label>
      <input class="${EXT_CLASS}-custom-delim" placeholder="Custom delimiter" style="display:none" />
      <label class="${EXT_CLASS}-checkbox"><input type="checkbox" class="${EXT_CLASS}-include-headers" checked> Include header row</label>
      <label class="${EXT_CLASS}-checkbox"><input type="checkbox" class="${EXT_CLASS}-always-quote"> Always quote cells</label>
      <button class="${EXT_CLASS}-copy">Copy</button>
      <button class="${EXT_CLASS}-clear">Clear selection</button>
      <button class="${EXT_CLASS}-download">Download (CSV)</button>
    </div>
    <div class="${EXT_CLASS}-hint">Tip: Use the header checkboxes to pick columns, and the left edge to pick rows. Shift-click a row checkbox to select a range.</div>
  `;
    const delimSelect = qs(toolbar, `.${EXT_CLASS}-delimiter`);
    const customInput = qs(toolbar, `.${EXT_CLASS}-custom-delim`);
    delimSelect.addEventListener("change", () => {
      customInput.style.display = delimSelect.value === "custom" ? "" : "none";
    });
    return toolbar;
  }
  function injectSelectors(table, state) {
    if (!table.tHead) {
      const thead = table.createTHead();
      const firstRow = table.rows[0];
      if (firstRow) thead.appendChild(firstRow);
    }
    if (!table.tBodies || table.tBodies.length === 0) {
      const tbody = document.createElement("tbody");
      while (table.rows.length > 1) tbody.appendChild(table.rows[1]);
      table.appendChild(tbody);
    }
    const headRow = table.tHead.rows[0];
    const colCount = headRow ? headRow.cells.length : table.rows[0]?.cells.length ?? 0;
    const leftTh = document.createElement("th");
    leftTh.className = `${EXT_CLASS}-row-select-th`;
    leftTh.title = "Select all rows";
    const allRowsCb = document.createElement("input");
    allRowsCb.type = "checkbox";
    allRowsCb.addEventListener("change", () => {
      state.selectedRows.clear();
      if (allRowsCb.checked) {
        for (let i = 0; i < table.tBodies[0].rows.length; i++) state.selectedRows.add(i);
      }
      state.refreshRowCheckboxes();
    });
    leftTh.appendChild(allRowsCb);
    headRow.insertBefore(leftTh, headRow.cells[0] || null);
    function refreshRowCheckboxes() {
      Array.from(table.tBodies[0].rows).forEach((tr, idx) => {
        let cbCell = tr.querySelector(`th.${EXT_CLASS}-row-select, td.${EXT_CLASS}-row-select`);
        if (!cbCell) {
          const td = document.createElement("td");
          td.className = `${EXT_CLASS}-row-select`;
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.addEventListener("click", (e) => {
            const rowIndex = idx;
            if (e.shiftKey && state.lastRowClickIndex != null) {
              const [a, b] = [state.lastRowClickIndex, rowIndex].sort((x, y) => x - y);
              for (let i = a; i <= b; i++) state.selectedRows.add(i);
            } else {
              if (state.selectedRows.has(rowIndex)) state.selectedRows.delete(rowIndex);
              else state.selectedRows.add(rowIndex);
              state.lastRowClickIndex = rowIndex;
            }
            allRowsCb.checked = state.selectedRows.size === table.tBodies[0].rows.length;
          });
          td.appendChild(cb);
          tr.insertBefore(td, tr.cells[0] || null);
        } else {
          const cb = cbCell.querySelector('input[type="checkbox"]');
          cb.checked = state.selectedRows.has(idx);
        }
      });
    }
    refreshRowCheckboxes();
    state.refreshRowCheckboxes = refreshRowCheckboxes;
    for (let c = 0; c < colCount; c++) {
      const th = headRow.cells[c + 1];
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
      th.textContent = "";
      th.appendChild(wrapper);
    }
  }
  function gatherData(table, state, options) {
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);
    const { includeHeader } = options;
    const selectedRows = state.selectedRows.size ? rows.filter((_, i) => state.selectedRows.has(i)) : rows;
    const allColsCount = table.tHead.rows[0].cells.length - 1;
    const selectedCols = state.selectedCols.size ? Array.from(state.selectedCols).sort((a, b) => a - b) : Array.from({ length: allColsCount }, (_, i) => i);
    const readCell = (tr, colIdx) => tr.cells[colIdx + 1]?.innerText ?? "";
    const matrix = [];
    if (includeHeader && table.tHead && table.tHead.rows.length) {
      const headerRow = [];
      for (const c of selectedCols) {
        headerRow.push(table.tHead.rows[0].cells[c + 1]?.innerText ?? "");
      }
      matrix.push(headerRow);
    }
    for (const tr of selectedRows) {
      const row = [];
      for (const c of selectedCols) row.push(readCell(tr, c));
      matrix.push(row);
    }
    return matrix;
  }
  async function onCopyClick(table, state, delimiter, includeHeader, alwaysQuote) {
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
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    }
  }
  function onDownloadClick(table, state, delimiter, includeHeader, alwaysQuote) {
    const matrix = gatherData(table, state, { includeHeader });
    const text = toDelimited(matrix, delimiter, alwaysQuote);
    const ext = delimiter === "	" ? "tsv" : "csv";
    downloadTextFile(`table-selection.${ext}`, text);
  }
  function attach(table) {
    if (table.getAttribute(PROCESSED_ATTR)) return;
    if (!detectSimpleTable(table)) return;
    table.setAttribute(PROCESSED_ATTR, "1");
    table.classList.add(`${EXT_CLASS}-table`);
    const state = {
      selectedRows: /* @__PURE__ */ new Set(),
      selectedCols: /* @__PURE__ */ new Set(),
      lastRowClickIndex: null,
      refreshRowCheckboxes: () => {
      }
    };
    injectSelectors(table, state);
    const toolbar = buildToolbar();
    table.insertAdjacentElement("beforebegin", toolbar);
    const copyBtn = qs(toolbar, `.${EXT_CLASS}-copy`);
    const clearBtn = qs(toolbar, `.${EXT_CLASS}-clear`);
    const downloadBtn = qs(toolbar, `.${EXT_CLASS}-download`);
    const includeHeadersCb = qs(toolbar, `.${EXT_CLASS}-include-headers`);
    const alwaysQuoteCb = qs(toolbar, `.${EXT_CLASS}-always-quote`);
    const delimSelect = qs(toolbar, `.${EXT_CLASS}-delimiter`);
    const customInput = qs(toolbar, `.${EXT_CLASS}-custom-delim`);
    copyBtn.addEventListener("click", async () => {
      const raw = delimSelect.value;
      const delimiter = raw === "custom" ? customInput.value || "," : raw;
      const ok = await onCopyClick(table, state, delimiter, includeHeadersCb.checked, alwaysQuoteCb.checked);
      copyBtn.textContent = ok ? "Copied!" : "Copy failed";
      window.setTimeout(() => copyBtn.textContent = "Copy", 1200);
    });
    downloadBtn.addEventListener("click", () => {
      const raw = delimSelect.value;
      const delimiter = raw === "custom" ? customInput.value || "," : raw;
      onDownloadClick(table, state, delimiter, includeHeadersCb.checked, alwaysQuoteCb.checked);
    });
    clearBtn.addEventListener("click", () => {
      state.selectedRows.clear();
      state.selectedCols.clear();
      qsa(table, `.${EXT_CLASS}-col-cb`).forEach((cb) => cb.checked = false);
      state.refreshRowCheckboxes();
    });
  }
  function scanShadowRoots(root = document) {
    const hosts = Array.from(root.querySelectorAll("*")).filter((el) => el.shadowRoot);
    for (const host of hosts) {
      const sr = host.shadowRoot;
      init(sr);
    }
  }
  function init(root = document) {
    const tryAttach = throttle(() => {
      qsa(root, "table").forEach(attach);
      if (root === document) scanShadowRoots(root);
    }, 400);
    tryAttach();
    const mo = new MutationObserver(tryAttach);
    mo.observe(root, { childList: true, subtree: true });
    window.addEventListener("resize", tryAttach);
  }

  // src/content.ts
  (() => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => init(document));
    } else {
      init(document);
    }
  })();
})();
