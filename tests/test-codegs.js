const fs = require("fs");
const vm = require("vm");

const code = fs.readFileSync(require("path").join(__dirname, "..", "google-apps-script", "Code.gs"), "utf8");

class MockSheet {
  constructor() { this.rows = []; this.frozen = 0; }
  getLastRow() { return this.rows.length; }
  getSheetByName() { return this; }
  appendRow(row) { this.rows.push(row); }
  getRange(row, col, numRows, numCols) {
    const self = this;
    return {
      setValues(values) { for (const valueRow of values) self.rows[row - 1] = valueRow.slice(); },
      getValues() {
        if (row === 1 && self.rows.length === 0) return [["", ...Array(Math.max(0, numCols - 1)).fill("")]];
        return [self.rows[row - 1] ? self.rows[row - 1].slice(col - 1, col - 1 + numCols) : Array(numCols).fill("")];
      }
    };
  }
  setFrozenRows(n) { this.frozen = n; }
}

const sheet = new MockSheet();
const cache = new Map();
const context = {
  console: { log: console.log, error: () => {}, warn: console.warn },
  JSON,
  String,
  Number,
  Array,
  Object,
  Date,
  Math,
  isNaN,
  parseInt,
  LockService: { getScriptLock: () => ({ waitLock(){}, releaseLock(){} }) },
  CacheService: { getScriptCache: () => ({ get(k){return cache.get(k)||null;}, put(k,v){cache.set(k,v);} }) },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) },
  Utilities: { formatDate: (date, _tz, format) => format === "yyyyMMdd" ? "20260926" : format === "yyyy-MM-dd" ? "2026-09-26" : "08:40:00" },
  ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: value => ({ value, setMimeType(){return this;} }) },
  HtmlService: { XFrameOptionsMode: { ALLOWALL: "ALLOWALL" }, createHtmlOutput: html => ({ html, setXFrameOptionsMode(){return this;} }) }
};
vm.createContext(context);
vm.runInContext(code, context);

function payload(data) { return { parameter: { payload: JSON.stringify(data) } }; }
function extractHtmlResult(response) {
  const match = response.html.match(/postMessage\((\{.*\}),\s*"https:\/\/mdparvezmussaruf\.github\.io"\)/s);
  if (!match) throw new Error("Could not extract result JSON from Apps Script HTML response.");
  return JSON.parse(match[1]);
}

const order = {
  clientRequestId: "test-request-001",
  customerName: "Smoke Tester",
  phone: "01712345678",
  address: "Joydevpur, Gazipur, Bangladesh",
  deliveryArea: "outside",
  note: "Leave with reception",
  items: [{id:"P001", quantity:2}, {id:"P003", quantity:1}]
};

const success = extractHtmlResult(context.doPost(payload(order)));
if (!success.success) throw new Error("Expected successful order.");
if (success.subtotal !== 5070) throw new Error(`Expected subtotal 5070, got ${success.subtotal}`);
if (success.deliveryCharge !== 100) throw new Error(`Expected delivery charge 100, got ${success.deliveryCharge}`);
if (success.total !== 5170) throw new Error(`Expected total 5170, got ${success.total}`);
if (sheet.rows.length !== 2) throw new Error("Expected one header row plus one saved order row.");
if (sheet.rows[1][13] !== 5170) throw new Error("Saved total amount mismatch.");

const duplicate = extractHtmlResult(context.doPost(payload(order)));
if (!duplicate.success || duplicate.orderId !== success.orderId) throw new Error("Duplicate request did not return the cached original order.");
if (sheet.rows.length !== 2) throw new Error("Duplicate request created another order row.");

const invalid = extractHtmlResult(context.doPost(payload({...order, clientRequestId:"test-request-002", deliveryArea:"mars"})));
if (invalid.success) throw new Error("Invalid delivery area should fail.");

console.log("PASS — Apps Script backend smoke tests");
console.log(`Order ${success.orderId} subtotal=${success.subtotal} delivery=${success.deliveryCharge} total=${success.total}`);
