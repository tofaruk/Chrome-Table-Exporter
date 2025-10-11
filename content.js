
(() => {
  const EXT_CLASS = "tpc-ext"; // namespace class to avoid collisions
  const PROCESSED_ATTR = "data-tpc-processed";

  // Helper: throttle
  function throttle(fn, wait) {
    let last = 0; let timer;
    return function(...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(timer); timer = null; last = now; fn.apply(this, args);
      } else if (!timer) {
        timer = setTimeout(() => { last = Date.now(); timer = null; fn.apply(this, args); }, remaining);
      }
    };
  }

  // RFC4180-ish CSV escaping
  function escapeCell(value, delimiter, quote = '"', alwaysQuote = false) {
    if (value == null) value = "";
    value = String(value).replace(/\r\n|\r|\n/g, "\n");
    const mustQuote = alwaysQuote || value.includes(delimiter) || value.includes(quote) || /\s/.test(delimiter) || /\n/.test(value);
    if (mustQuote) {
      return quote + value.replaceAll(quote, quote + quote) + quote;
    }
    return value;
  }

  function detectSimpleTable(table) {
    // Skip very complex header structures (colspans/rowspans). Basic support only.
    const rows = Array.from(table.rows);
    for (const r of rows) {
      for (const cell of Array.from(r.cells)) {
        if (cell.colSpan > 1 || cell.rowSpan > 1) return false;
      }
    }
    return rows.length > 0 && rows[0].cells.length > 0;
  }

  function buildToolbar(table) {
    const toolbar = document.createElement('div');
    toolbar.className = `${EXT_CLASS}-toolbar`;
    toolbar.innerHTML = `
      <div class="${EXT_CLASS}-toolbar-row">
        <label>Delimiter:
          <select class="${EXT_CLASS}-delimiter">
            <option value="," selected>Comma (,)</option>
            <option value="\\t">Tab (TSV)</option>
            <option value=";">Semicolon (;)</option>
            <option value="|">Pipe (|)</option>
            <option value="custom">Custom…</option>
          </select>
        </label>
        <input class="${EXT_CLASS}-custom-delim" placeholder="Custom delimiter" style="display:none" />
        <label class="${EXT_CLASS}-checkbox"><input type="checkbox" class="${EXT_CLASS}-include-headers" checked> Include header row</label>
        <label class="${EXT_CLASS}-checkbox"><input type="checkbox" class="${EXT_CLASS}-always-quote"> Always quote cells</label>
        <button class="${EXT_CLASS}-copy">Copy</button>
        <button class="${EXT_CLASS}-clear">Clear selection</button>
        <button class="${EXT_CLASS}-download">Download (CSV)</button>
      </div>
      <div class="${EXT_CLASS}-hint">Tip: Use the checkboxes added to the table header to pick columns, and the left edge to pick rows. Shift-click a row checkbox to select a range.</div>
    `;

    const delimSelect = toolbar.querySelector(`.${EXT_CLASS}-delimiter`);
    const customInput = toolbar.querySelector(`.${EXT_CLASS}-custom-delim`);
    delimSelect.addEventListener('change', () => {
      customInput.style.display = delimSelect.value === 'custom' ? '' : 'none';
    });

    return toolbar;
  }

  function injectSelectors(table, state) {
    // Ensure THEAD/TBODY exist
    if (!table.tHead) {
      const thead = table.createTHead();
      const firstRow = table.rows[0];
      if (firstRow) thead.appendChild(firstRow);
    }
    if (!table.tBodies || table.tBodies.length === 0) {
      const tbody = document.createElement('tbody');
      while (table.rows.length > 1) tbody.appendChild(table.rows[1]);
      table.appendChild(tbody);
    }

    const headRow = table.tHead.rows[0];
    const colCount = headRow ? headRow.cells.length : (table.rows[0]?.cells.length || 0);

    // Insert column of row checkboxes at the very left
    // 1) add header cell
    const leftTh = document.createElement('th');
    leftTh.className = `${EXT_CLASS}-row-select-th`;
    leftTh.title = 'Select all rows';
    const allRowsCb = document.createElement('input');
    allRowsCb.type = 'checkbox';
    allRowsCb.addEventListener('change', () => {
      state.selectedRows.clear();
      if (allRowsCb.checked) {
        for (let i = 0; i < table.tBodies[0].rows.length; i++) state.selectedRows.add(i);
      }
      refreshRowCheckboxes();
    });
    leftTh.appendChild(allRowsCb);
    headRow.insertBefore(leftTh, headRow.cells[0]);

    // 2) add per-row checkbox in tbody
    function refreshRowCheckboxes() {
      for (const [idx, tr] of Array.from(table.tBodies[0].rows).entries()) {
        let cbCell = tr.querySelector(`th.${EXT_CLASS}-row-select, td.${EXT_CLASS}-row-select`);
        if (!cbCell) {
          cbCell = document.createElement('td');
          cbCell.className = `${EXT_CLASS}-row-select`;
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.addEventListener('click', (e) => {
            const rowIndex = idx;
            if (e.shiftKey && state.lastRowClickIndex != null) {
              const [a, b] = [state.lastRowClickIndex, rowIndex].sort((x, y) => x - y);
              for (let i = a; i <= b; i++) state.selectedRows.add(i);
            } else {
              if (state.selectedRows.has(rowIndex)) state.selectedRows.delete(rowIndex); else state.selectedRows.add(rowIndex);
              state.lastRowClickIndex = rowIndex;
            }
            allRowsCb.checked = state.selectedRows.size === table.tBodies[0].rows.length;
          });
          cbCell.appendChild(cb);
          tr.insertBefore(cbCell, tr.cells[0]);
        } else {
          const cb = cbCell.querySelector('input[type="checkbox"]');
          cb.checked = state.selectedRows.has(idx);
        }
      }
    }

    refreshRowCheckboxes();

    // Add column checkboxes to header (after inserting the left row-select TH we offset by +1)
    for (let c = 0; c < colCount; c++) {
      const th = headRow.cells[c + 1];
      const wrapper = document.createElement('div');
      wrapper.className = `${EXT_CLASS}-col-header`;
      const titleSpan = document.createElement('span');
      titleSpan.textContent = th.textContent?.trim() || `Col ${c + 1}`;
      titleSpan.className = `${EXT_CLASS}-col-title`;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = `${EXT_CLASS}-col-cb`;
      cb.title = 'Select column';
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedCols.add(c); else state.selectedCols.delete(c);
      });
      wrapper.appendChild(cb);
      wrapper.appendChild(titleSpan);
      th.textContent = '';
      th.appendChild(wrapper);
    }

    // Store helpers on state
    state.refreshRowCheckboxes = refreshRowCheckboxes;
  }

  function gatherData(table, state, options) {
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);
    const includeHeader = options.includeHeader;
    const selectedRows = state.selectedRows.size ? rows.filter((_, i) => state.selectedRows.has(i)) : rows;

    const allColsCount = table.tHead.rows[0].cells.length - 1; // minus the added left select column
    const selectedCols = state.selectedCols.size ? Array.from(state.selectedCols).sort((a,b)=>a-b) : [...Array(allColsCount)].map((_,i)=>i);

    const readCell = (tr, colIdx) => tr.cells[colIdx + 1]?.innerText ?? '';

    const matrix = [];
    if (includeHeader && table.tHead && table.tHead.rows.length) {
      const headerRow = [];
      for (const c of selectedCols) {
        headerRow.push(table.tHead.rows[0].cells[c + 1]?.innerText ?? '');
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

  function toDelimited(matrix, delimiter, alwaysQuote) {
    return matrix.map(r => r.map(v => escapeCell(v, delimiter, '"', alwaysQuote)).join(delimiter)).join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
  }

  function attach(table) {
    if (table.getAttribute(PROCESSED_ATTR)) return;
    if (!detectSimpleTable(table)) return; // skip complex tables for safety

    table.setAttribute(PROCESSED_ATTR, '1');
    table.classList.add(`${EXT_CLASS}-table`);

    const state = {
      selectedRows: new Set(),
      selectedCols: new Set(),
      lastRowClickIndex: null,
      refreshRowCheckboxes: () => {}
    };

    injectSelectors(table, state);

    const toolbar = buildToolbar(table);
    table.insertAdjacentElement('beforebegin', toolbar);

    const copyBtn = toolbar.querySelector(`.${EXT_CLASS}-copy`);
    const downloadBtn = toolbar.querySelector(`.${EXT_CLASS}-download`);
    const clearBtn = toolbar.querySelector(`.${EXT_CLASS}-clear`);
    const includeHeadersCb = toolbar.querySelector(`.${EXT_CLASS}-include-headers`);
    const alwaysQuoteCb = toolbar.querySelector(`.${EXT_CLASS}-always-quote`);
    const delimSelect = toolbar.querySelector(`.${EXT_CLASS}-delimiter`);
    const customInput = toolbar.querySelector(`.${EXT_CLASS}-custom-delim`);

    copyBtn.addEventListener('click', async () => {
      let delim = delimSelect.value === 'custom' ? customInput.value : delimSelect.value;
      if (!delim || delim.length === 0) delim = ',';
      const matrix = gatherData(table, state, { includeHeader: includeHeadersCb.checked });
      const text = toDelimited(matrix, delim, alwaysQuoteCb.checked);
      const ok = await copyText(text);
      copyBtn.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
    });

    downloadBtn.addEventListener('click', () => {
      let delim = delimSelect.value === 'custom' ? customInput.value : delimSelect.value;
      if (!delim || delim.length === 0) delim = ',';

      const matrix = gatherData(table, state, { includeHeader: includeHeadersCb.checked });
      const text = toDelimited(matrix, delim, alwaysQuoteCb.checked);

      // Pick a reasonable extension based on delimiter
      const ext = (delim === '\t') ? 'tsv' : 'csv';
      const filename = `table-selection.${ext}`;
      downloadTextFile(filename, text);
  });

    clearBtn.addEventListener('click', () => {
      state.selectedRows.clear();
      state.selectedCols.clear();
      for (const cb of table.querySelectorAll(`.${EXT_CLASS}-col-cb`)) cb.checked = false;
      state.refreshRowCheckboxes();
    });
  }

  function init() {
    const tryAttach = throttle(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      for (const t of tables) attach(t);
    }, 400);

    // Initial pass
    tryAttach();

    // Re-run on DOM mutations (SPAs etc.)
    const mo = new MutationObserver(tryAttach);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Also on resize (some sites lazy-render tables)
    window.addEventListener('resize', tryAttach);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
