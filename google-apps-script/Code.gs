/*
 * ============================================================
 * ROVMART - Google Apps Script Backend
 * ============================================================
 *
 * Google Sheet tab: Orders
 *
 * Columns:
 * A Order ID
 * B Date
 * C Time
 * D Customer Name
 * E Phone
 * F Delivery Address
 * G Delivery Area
 * H Delivery Charge
 * I Product IDs
 * J Product Names
 * K Quantities
 * L Unit Prices
 * M Subtotal
 * N Total Amount
 * O Order Status
 * P Additional Note
 *
 * The backend is authoritative for product prices and delivery fees.
 * The browser sends product IDs + quantities only.
 * ============================================================
 */

const CONFIG = {
  SHEET_NAME: "Orders",
  TIMEZONE: "Asia/Dhaka",
  CURRENCY: "BDT",
  FRONTEND_ORIGIN: "https://mdparvezmussaruf.github.io",

  DELIVERY_CHARGES: {
    inside: 50,
    outside: 100
  },

  PRODUCTS: {
    P001: { name: "Noir Oversized Tee", price: 1290, available: true },
    P002: { name: "Studio Linen Shirt", price: 1890, available: true },
    P003: { name: "Essential Denim Jacket", price: 2490, available: true },
    P004: { name: "Minimal Cargo Trouser", price: 2190, available: true },
    P005: { name: "Quiet Form Hoodie", price: 1990, available: true },
    P006: { name: "Monochrome Polo", price: 1490, available: true },
    P007: { name: "Relaxed Chino", price: 1790, available: true },
    P008: { name: "Signature Overshirt", price: 2290, available: true }
  }
};

const SHEET_HEADERS = [
  "Order ID",
  "Date",
  "Time",
  "Customer Name",
  "Phone",
  "Delivery Address",
  "Delivery Area",
  "Delivery Charge",
  "Product IDs",
  "Product Names",
  "Quantities",
  "Unit Prices",
  "Subtotal",
  "Total Amount",
  "Order Status",
  "Additional Note"
];

function doGet() {
  return jsonResponse_({
    success: true,
    message: "ROVMART order API is running."
  });
}

function doPost(e) {
  let lock = null;

  try {
    const data = parseRequestPayload_(e);
    const validated = validateAndCalculate_(data);
    const sheet = getOrdersSheet_();

    lock = LockService.getScriptLock();
    lock.waitLock(15000);

    const cached = getCachedOrderResult_(validated.clientRequestId);
    if (cached) {
      return htmlPostMessageResponse_(cached);
    }

    const now = new Date();
    const orderId = createOrderId_(now, sheet);
    const date = Utilities.formatDate(now, CONFIG.TIMEZONE, "yyyy-MM-dd");
    const time = Utilities.formatDate(now, CONFIG.TIMEZONE, "HH:mm:ss");

    sheet.appendRow([
      orderId,
      date,
      time,
      validated.customerName,
      validated.phone,
      validated.address,
      validated.deliveryAreaLabel,
      validated.deliveryCharge,
      validated.productIds,
      validated.productNames,
      validated.quantities,
      validated.unitPrices,
      validated.subtotal,
      validated.total,
      "Pending",
      validated.note
    ]);

    const result = {
      type: "ROVMART_ORDER_RESULT",
      success: true,
      clientRequestId: validated.clientRequestId,
      orderId: orderId,
      subtotal: validated.subtotal,
      deliveryArea: validated.deliveryAreaLabel,
      deliveryCharge: validated.deliveryCharge,
      total: validated.total
    };

    cacheOrderResult_(validated.clientRequestId, result);
    return htmlPostMessageResponse_(result);
  } catch (err) {
    console.error(err);

    const requestId = getRequestId_(e);
    return htmlPostMessageResponse_({
      type: "ROVMART_ORDER_RESULT",
      success: false,
      clientRequestId: requestId,
      message: getSafeErrorMessage_(err)
    });
  } finally {
    if (lock) {
      try { lock.releaseLock(); } catch (_) {}
    }
  }
}

function parseRequestPayload_(e) {
  if (!e) throw new Error("Invalid request.");

  if (e.parameter && e.parameter.payload) {
    try {
      return JSON.parse(e.parameter.payload);
    } catch (_) {
      throw new Error("Invalid order payload.");
    }
  }

  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (_) {
      throw new Error("Invalid JSON request.");
    }
  }

  throw new Error("No order data received.");
}

function validateAndCalculate_(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid order data.");
  }

  const clientRequestId = String(data.clientRequestId || "").trim();
  const customerName = String(data.customerName || "").trim();
  const phone = String(data.phone || "").trim();
  const address = String(data.address || "").trim();
  const note = String(data.note || "").trim();
  const deliveryArea = String(data.deliveryArea || "").trim().toLowerCase();
  const items = Array.isArray(data.items) ? data.items : [];

  if (!/^[A-Za-z0-9_-]{10,80}$/.test(clientRequestId)) {
    throw new Error("Invalid request ID.");
  }

  if (customerName.length < 2 || customerName.length > 100) {
    throw new Error("Invalid customer name.");
  }

  const normalizedPhone = phone.replace(/[\s-]/g, "");
  if (!/^(01\d{9}|\+8801\d{9})$/.test(normalizedPhone)) {
    throw new Error("Invalid phone number.");
  }

  if (address.length < 8 || address.length > 1000) {
    throw new Error("Invalid address.");
  }

  if (deliveryArea !== "inside" && deliveryArea !== "outside") {
    throw new Error("Invalid delivery area.");
  }

  const deliveryCharge = CONFIG.DELIVERY_CHARGES[deliveryArea];
  if (!Number.isFinite(deliveryCharge) || deliveryCharge < 0) {
    throw new Error("Invalid delivery charge.");
  }

  if (!items.length || items.length > 50) {
    throw new Error("Invalid cart.");
  }

  const seen = {};
  let subtotal = 0;
  const productIds = [];
  const productNames = [];
  const quantities = [];
  const unitPrices = [];

  items.forEach(function(item) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid cart item.");
    }

    const id = String(item.id || "").trim();
    const quantity = Number(item.quantity);
    const product = CONFIG.PRODUCTS[id];

    if (!product || !product.available) {
      throw new Error("Invalid or unavailable product.");
    }

    if (seen[id]) {
      throw new Error("Duplicate product in cart.");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("Invalid quantity.");
    }

    seen[id] = true;
    productIds.push(id);
    productNames.push(product.name);
    quantities.push(quantity);
    unitPrices.push(product.price);
    subtotal += product.price * quantity;
  });

  const total = subtotal + deliveryCharge;
  const deliveryAreaLabel = deliveryArea === "inside" ? "Inside Dhaka" : "Outside Dhaka";

  return {
    clientRequestId: clientRequestId,
    customerName: customerName,
    phone: normalizedPhone,
    address: address,
    deliveryArea: deliveryArea,
    deliveryAreaLabel: deliveryAreaLabel,
    deliveryCharge: deliveryCharge,
    note: note.slice(0, 1000),
    productIds: productIds.join(", "),
    productNames: productNames.join(", "),
    quantities: quantities.join(", "),
    unitPrices: unitPrices.join(", "),
    subtotal: subtotal,
    total: total
  };
}

function getOrdersSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("No active spreadsheet.");

  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  const existing = sheet.getRange(1, 1, 1, SHEET_HEADERS.length).getValues()[0];
  SHEET_HEADERS.forEach(function(header, index) {
    if (String(existing[index] || "").trim() !== header) {
      throw new Error("Orders sheet headers do not match the ROVMART schema.");
    }
  });

  sheet.setFrozenRows(1);
  return sheet;
}

function createOrderId_(date, sheet) {
  const datePart = Utilities.formatDate(date, CONFIG.TIMEZONE, "yyyyMMdd");
  const prefix = "ORD-" + datePart + "-";
  const lastRow = sheet.getLastRow();
  let sequence = 1;

  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    const todayNumbers = values
      .filter(function(value) { return String(value).indexOf(prefix) === 0; })
      .map(function(value) { return Number(String(value).split("-").pop()); })
      .filter(function(value) { return Number.isFinite(value); });

    if (todayNumbers.length) sequence = Math.max.apply(null, todayNumbers) + 1;
  }

  return prefix + String(sequence).padStart(4, "0");
}

function getRequestId_(e) {
  try {
    if (e && e.parameter && e.parameter.payload) {
      const parsed = JSON.parse(e.parameter.payload);
      return String(parsed.clientRequestId || "").trim();
    }
    if (e && e.postData && e.postData.contents) {
      const parsed = JSON.parse(e.postData.contents);
      return String(parsed.clientRequestId || "").trim();
    }
  } catch (_) {}
  return "";
}

function getCachedOrderResult_(requestId) {
  if (!requestId) return null;
  const raw = CacheService.getScriptCache().get("order:" + requestId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function cacheOrderResult_(requestId, result) {
  if (!requestId) return;
  CacheService.getScriptCache().put(
    "order:" + requestId,
    JSON.stringify(result),
    21600
  );
}

function getSafeErrorMessage_(err) {
  const known = [
    "Invalid request.",
    "Invalid order data.",
    "Invalid order payload.",
    "Invalid JSON request.",
    "No order data received.",
    "Invalid request ID.",
    "Invalid customer name.",
    "Invalid phone number.",
    "Invalid address.",
    "Invalid delivery area.",
    "Invalid delivery charge.",
    "Invalid cart.",
    "Invalid cart item.",
    "Invalid or unavailable product.",
    "Duplicate product in cart.",
    "Invalid quantity."
  ];

  const message = err && err.message ? String(err.message) : "";
  return known.indexOf(message) !== -1 ? message : "Unable to submit order.";
}

function htmlPostMessageResponse_(result) {
  const safeJson = JSON.stringify(result)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  const targetOrigin = JSON.stringify(CONFIG.FRONTEND_ORIGIN);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>ROVMART Order Response</title></head>
<body>
<script>
(function () {
  try {
    window.parent.postMessage(${safeJson}, ${targetOrigin});
  } catch (error) {
    console.error(error);
  }
})();
</script>
<p>ROVMART order processed.</p>
</body>
</html>`;

  return HtmlService
    .createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function jsonResponse_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
