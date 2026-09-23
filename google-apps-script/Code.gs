/*
  ROVMART Fashion Store - Google Apps Script backend

  Google Sheet:
  Create a spreadsheet and a sheet named "Orders".

  The script will use these columns:

  Order ID
  Date
  Time
  Customer Name
  Phone
  Delivery Address
  Delivery Area
  Delivery Charge
  Product IDs
  Product Names
  Quantities
  Unit Prices
  Subtotal
  Total Amount
  Order Status
  Additional Note

  IMPORTANT:
  The backend keeps the authoritative product prices here.
  Update this catalog whenever you change prices in products.js.

  Delivery charges are also controlled here:
  Inside Dhaka  = ৳50
  Outside Dhaka = ৳100
*/

const CONFIG = {

  SHEET_NAME: "Orders",

  TIMEZONE: "Asia/Dhaka",

  CURRENCY: "BDT",

  /*
    AUTHORITATIVE DELIVERY CHARGES

    The browser sends only:
    "inside"
    or
    "outside"

    The server determines the actual charge.
  */
  DELIVERY_CHARGES: {
    inside: 50,
    outside: 100
  },

  /*
    AUTHORITATIVE PRODUCT CATALOG
  */
  PRODUCTS: {

    P001: {
      name: "Noir Oversized Tee",
      price: 1290,
      available: true
    },

    P002: {
      name: "Studio Linen Shirt",
      price: 1890,
      available: true
    },

    P003: {
      name: "Essential Denim Jacket",
      price: 2490,
      available: true
    },

    P004: {
      name: "Minimal Cargo Trouser",
      price: 2190,
      available: true
    },

    P005: {
      name: "Quiet Form Hoodie",
      price: 1990,
      available: true
    },

    P006: {
      name: "Monochrome Polo",
      price: 1490,
      available: true
    },

    P007: {
      name: "Relaxed Chino",
      price: 1790,
      available: true
    },

    P008: {
      name: "Signature Overshirt",
      price: 2290,
      available: true
    }

  }

};


/* =========================================================
   GET
========================================================= */

function doGet() {

  return jsonResponse_({
    success: true,
    message: "ROVMART order API is running."
  });

}


/* =========================================================
   POST ORDER
========================================================= */

function doPost(e) {

  try {

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {

      return jsonResponse_({
        success: false,
        message: "Invalid request."
      });

    }


    const data =
      JSON.parse(
        e.postData.contents
      );


    /*
      Validate customer data,
      products,
      delivery area,
      prices,
      subtotal,
      final total.
    */
    const validated =
      validateAndCalculate_(data);


    const sheet =
      getOrdersSheet_();


    /*
      Prevent two simultaneous orders
      from getting the same order ID.
    */
    const lock =
      LockService.getScriptLock();


    lock.waitLock(15000);


    try {

      const now =
        new Date();


      const orderId =
        createOrderId_(
          now,
          sheet
        );


      const date =
        Utilities.formatDate(
          now,
          CONFIG.TIMEZONE,
          "yyyy-MM-dd"
        );


      const time =
        Utilities.formatDate(
          now,
          CONFIG.TIMEZONE,
          "HH:mm:ss"
        );


      /*
        Save complete order.
      */
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


      return jsonResponse_({

        success: true,

        orderId: orderId,

        subtotal:
          validated.subtotal,

        deliveryArea:
          validated.deliveryAreaLabel,

        deliveryCharge:
          validated.deliveryCharge,

        total:
          validated.total

      });


    } finally {

      lock.releaseLock();

    }


  } catch (err) {

    console.error(err);


    return jsonResponse_({

      success: false,

      message:
        "Unable to submit order."

    });

  }

}


/* =========================================================
   VALIDATE ORDER + CALCULATE TOTAL
========================================================= */

function validateAndCalculate_(data) {

  const customerName =
    String(
      data.customerName || ""
    ).trim();


  const phone =
    String(
      data.phone || ""
    ).trim();


  const address =
    String(
      data.address || ""
    ).trim();


  const note =
    String(
      data.note || ""
    ).trim();


  /*
    Delivery area sent from frontend:
      inside
      outside
  */
  const deliveryArea =
    String(
      data.deliveryArea || ""
    ).trim()
    .toLowerCase();


  const items =
    Array.isArray(data.items)
      ? data.items
      : [];


  /* -----------------------------------------
     CUSTOMER NAME
  ----------------------------------------- */

  if (
    customerName.length < 2 ||
    customerName.length > 100
  ) {

    throw new Error(
      "Invalid customer name."
    );

  }


  /* -----------------------------------------
     PHONE
  ----------------------------------------- */

  const normalizedPhone =
    phone.replace(
      /[\s-]/g,
      ""
    );


  /*
    Accepted formats:

    01712345678

    +8801712345678
  */
  if (
    !/^(01\d{9}|\+8801\d{9})$/.test(
      normalizedPhone
    )
  ) {

    throw new Error(
      "Invalid phone number."
    );

  }


  /* -----------------------------------------
     DELIVERY ADDRESS
  ----------------------------------------- */

  if (
    address.length < 8 ||
    address.length > 1000
  ) {

    throw new Error(
      "Invalid address."
    );

  }


  /* -----------------------------------------
     DELIVERY AREA
  ----------------------------------------- */

  if (
    deliveryArea !== "inside" &&
    deliveryArea !== "outside"
  ) {

    throw new Error(
      "Invalid delivery area."
    );

  }


  const deliveryCharge =
    CONFIG.DELIVERY_CHARGES[
      deliveryArea
    ];


  if (
    typeof deliveryCharge !== "number"
  ) {

    throw new Error(
      "Invalid delivery charge."
    );

  }


  const deliveryAreaLabel =
    deliveryArea === "inside"
      ? "Inside Dhaka"
      : "Outside Dhaka";


  /* -----------------------------------------
     CART
  ----------------------------------------- */

  if (
    !items.length ||
    items.length > 50
  ) {

    throw new Error(
      "Invalid cart."
    );

  }


  let subtotal = 0;


  const productIds = [];

  const productNames = [];

  const quantities = [];

  const unitPrices = [];


  /* -----------------------------------------
     VALIDATE PRODUCTS
  ----------------------------------------- */

  items.forEach(item => {

    const id =
      String(
        item.id || ""
      ).trim();


    const quantity =
      Number(
        item.quantity
      );


    const product =
      CONFIG.PRODUCTS[id];


    /*
      Product must exist
      and be available.
    */
    if (
      !product ||
      !product.available
    ) {

      throw new Error(
        "Invalid product."
      );

    }


    /*
      Quantity must be:

      integer
      minimum 1
      maximum 99
    */
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {

      throw new Error(
        "Invalid quantity."
      );

    }


    productIds.push(id);

    productNames.push(
      product.name
    );

    quantities.push(
      quantity
    );

    unitPrices.push(
      product.price
    );


    /*
      IMPORTANT:
      Use backend price,
      NOT browser price.
    */
    subtotal +=
      product.price * quantity;

  });


  /* -----------------------------------------
     FINAL TOTAL
  ----------------------------------------- */

  const total =
    subtotal +
    deliveryCharge;


  /* -----------------------------------------
     RETURN VALIDATED ORDER
  ----------------------------------------- */

  return {

    customerName:
      customerName,

    phone:
      normalizedPhone,

    address:
      address,

    deliveryArea:
      deliveryArea,

    deliveryAreaLabel:
      deliveryAreaLabel,

    deliveryCharge:
      deliveryCharge,

    note:
      note.slice(
        0,
        1000
      ),

    productIds:
      productIds.join(", "),

    productNames:
      productNames.join(", "),

    quantities:
      quantities.join(", "),

    unitPrices:
      unitPrices.join(", "),

    subtotal:
      subtotal,

    total:
      total

  };

}


/* =========================================================
   GET / CREATE ORDERS SHEET
========================================================= */

function getOrdersSheet_() {

  const spreadsheet =
    SpreadsheetApp
      .getActiveSpreadsheet();


  if (!spreadsheet) {

    throw new Error(
      "No active spreadsheet."
    );

  }


  let sheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEET_NAME
    );


  /*
    Create Orders sheet automatically
    if it does not exist.
  */
  if (!sheet) {

    sheet =
      spreadsheet.insertSheet(
        CONFIG.SHEET_NAME
      );

  }


  /*
    Add headers when the sheet is empty.
  */
  if (
    sheet.getLastRow() === 0
  ) {

    sheet.appendRow([

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

    ]);


    sheet.setFrozenRows(1);

  }


  return sheet;

}


/* =========================================================
   ORDER ID
========================================================= */

function createOrderId_(
  date,
  sheet
) {

  const datePart =
    Utilities.formatDate(
      date,
      CONFIG.TIMEZONE,
      "yyyyMMdd"
    );


  const prefix =
    "ORD-" +
    datePart +
    "-";


  const lastRow =
    sheet.getLastRow();


  let sequence = 1;


  if (
    lastRow > 1
  ) {

    const values =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          1
        )
        .getValues()
        .flat();


    const todayNumbers =
      values

        .filter(
          value =>
            String(value)
              .indexOf(prefix) === 0
        )

        .map(
          value =>
            Number(
              String(value)
                .split("-")
                .pop()
            )
        )

        .filter(
          number =>
            Number.isFinite(number)
        );


    if (
      todayNumbers.length
    ) {

      sequence =
        Math.max(
          ...todayNumbers
        ) + 1;

    }

  }


  return (
    prefix +
    String(sequence)
      .padStart(4, "0")
  );

}


/* =========================================================
   JSON RESPONSE
========================================================= */

function jsonResponse_(object) {

  return ContentService

    .createTextOutput(
      JSON.stringify(object)
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );

}