# Chrome Table Exporter (MV3, TypeScript)

Select specific **rows and columns** from any simple HTML table on the web and **copy or download** the selection as CSV/TSV — right from the page.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)](#)
[![MV3](https://img.shields.io/badge/Chrome-MV3-orange.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Tests](https://img.shields.io/badge/Tests-Vitest%20%2B%20jsdom-7289da.svg)](#tests)
[![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg)](#tests)
[![License](https://img.shields.io/badge/License-MIT-black.svg)](#license)

---

## ✨ Features

- ✅ MV3 extension, **TypeScript** codebase, modular helpers
- ✅ Injects a small toolbar **before** each simple `<table>`
- ✅ Header **checkboxes to pick columns**, a leftmost **column to pick rows** (Shift-click for ranges)
- ✅ **Copy to clipboard** or **Download CSV/TSV** (Excel/Sheets friendly)
- ✅ Skips complex `rowspan/colspan` tables for predictable selection
- ✅ **100% test coverage** (Vitest + jsdom, enforced)

---

## Demo

> Screenshots/GIFs go here (optional).  
> Put files under `docs/` and reference them like:

- ![Toolbar above table](docs/toolbar.png)
- ![Selecting rows and columns](docs/select-rows-cols.gif)

---

## Installation (Chrome)

1. **Build the extension**
   ```bash
   npm i
   npm run build
