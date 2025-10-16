
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { attach, detectSimpleTable, gatherData } from '../src/core';

function makeTable(html: string) {
  const dom = new JSDOM(`<body>${html}</body>`);
  const doc = dom.window.document;
  return { doc, table: doc.querySelector('table') as HTMLTableElement };
}

const SIMPLE_TABLE = `
<table>
  <thead><tr><th>H1</th><th>H2</th></tr></thead>
  <tbody>
    <tr><td>a1</td><td>b1</td></tr>
    <tr><td>a2</td><td>b2</td></tr>
  </tbody>
</table>
`;

describe('core', () => {
  it('detects simple tables', () => {
    const { table } = makeTable(SIMPLE_TABLE);
    expect(detectSimpleTable(table)).toBe(true);
  });

  it('rejects tables with colspan/rowspan', () => {
    const { table } = makeTable(`<table><tr><td colspan="2">x</td></tr></table>`);
    expect(detectSimpleTable(table)).toBe(false);
  });

  it('attaches toolbar and selectors', () => {
    const { doc, table } = makeTable(SIMPLE_TABLE);
    attach(table);
    const toolbar = doc.querySelector('.tpc-ext-toolbar') as HTMLElement;
    expect(toolbar).toBeTruthy();
    expect(toolbar.nextElementSibling).toBe(table);
    const leftHeader = doc.querySelector('.tpc-ext-row-select-th');
    expect(leftHeader).toBeTruthy();
    const colCbs = doc.querySelectorAll('.tpc-ext-col-cb');
    expect(colCbs.length).toBe(2);
  });

  it('gathers data with/without header and column selection', () => {
    const { doc, table } = makeTable(SIMPLE_TABLE);
    attach(table);
    const firstColCb = doc.querySelectorAll('.tpc-ext-col-cb')[0] as HTMLInputElement;
    firstColCb.checked = true;
    firstColCb.dispatchEvent(new doc.defaultView!.Event('change'));

    const rowCbs = doc.querySelectorAll('.tpc-ext-row-select input');
    const secondRowCb = rowCbs[1] as HTMLInputElement;
    secondRowCb.click();

    const state = {
      selectedRows: new Set([1]),
      selectedCols: new Set([0]),
      lastRowClickIndex: 1,
      refreshRowCheckboxes: () => {}
    };

    const withHeader = gatherData(table, state as any, { includeHeader: true });
    expect(withHeader).toEqual([['H1'], ['a2']]);

    const noHeader = gatherData(table, state as any, { includeHeader: false });
    expect(noHeader).toEqual([['a2']]);
  });
});
