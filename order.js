/*
 * ============================================================
 * ROVMART - ORDER / CHECKOUT SYSTEM
 * ============================================================
 *
 * Flow:
 *
 * Customer
 *    ↓
 * Checkout form
 *    ↓
 * order.js validation
 *    ↓
 * Native HTML form POST
 *    ↓
 * Google Apps Script
 *    ↓
 * Google Sheets
 *    ↓
 * HTML response inside hidden iframe
 *    ↓
 * window.parent.postMessage()
 *    ↓
 * order.js receives result
 *    ↓
 * Success / Error
 *
 * IMPORTANT:
 *
 * - Browser sends product ID + quantity.
 * - Browser sends delivery AREA only.
 * - Backend calculates product prices.
 * - Backend calculates delivery charge.
 * - Backend calculates final total.
 *
 * ============================================================
 */


/* ============================================================
   STATE
   ============================================================ */

let pendingOrderSubmission = null;


/* ============================================================
   CONFIG HELPERS
   ============================================================ */

function getConfigScriptUrl() {

  if (
    typeof CONFIG === "undefined" ||
    !CONFIG
  ) {
    return "";
  }

  return String(
    CONFIG.GOOGLE_SCRIPT_URL || ""
  ).trim();

}


function isValidScriptUrl(url) {

  if (!url) {
    return false;
  }


  /*
   * Reject placeholder only.
   *
   * IMPORTANT:
   * Do NOT compare this against the real Apps Script URL.
   */
  if (
    url.includes(
      "https://script.google.com/macros/s/AKfycbzTMyuIddg7-jdp-Fb0U-w3kPS6BYc1v3nT30mo4siAxe-65Z1VY9c6TxsKgtPqE03wgA/exec"
    )
  ) {
    return false;
  }


  /*
   * Must be a Google Apps Script Web App /exec URL.
   */
  return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/
    .test(url);

}


/* ============================================================
   DELIVERY
   ============================================================ */

function getSelectedDeliveryArea() {

  const selected =
    document.querySelector(
      'input[name="deliveryArea"]:checked'
    );

  return selected
    ? String(selected.value || "").trim().toLowerCase()
    : "";

}


function getSelectedDeliveryCharge() {

  const area =
    getSelectedDeliveryArea();


  if (
    typeof CONFIG === "undefined" ||
    !CONFIG ||
    !CONFIG.DELIVERY_CHARGES
  ) {
    return 0;
  }


  const charge =
    Number(
      CONFIG.DELIVERY_CHARGES[area]
    );


  return Number.isFinite(charge)
    ? charge
    : 0;

}


/* ============================================================
   OPEN ORDER MODAL
   ============================================================ */

function openOrderModal() {

  if (
    typeof getCartQuantity !== "function" ||
    getCartQuantity() === 0
  ) {

    if (
      typeof showToast === "function"
    ) {

      showToast(
        "Your cart is empty."
      );

    }

    return;

  }


  if (
    typeof closeCartDrawer === "function"
  ) {

    closeCartDrawer();

  }


  const modal =
    document.getElementById(
      "orderModal"
    );


  if (!modal) {
    return;
  }


  /*
   * Reset pending state.
   */
  pendingOrderSubmission =
    null;


  /*
   * Show modal.
   */
  modal.classList.remove(
    "hidden"
  );


  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.classList.add(
    "no-scroll"
  );


  /*
   * Render current cart.
   */
  renderOrderSummary();

  updateDeliverySummary();


  /*
   * Focus name field.
   */
  document
    .getElementById(
      "customerName"
    )
    ?.focus();

}


/* ============================================================
   CLOSE ORDER MODAL
   ============================================================ */

function closeOrderModal() {

  /*
   * Never close during submission.
   */
  if (
    pendingOrderSubmission
  ) {

    return;

  }


  const modal =
    document.getElementById(
      "orderModal"
    );


  if (!modal) {
    return;
  }


  modal.classList.add(
    "hidden"
  );


  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.classList.remove(
    "no-scroll"
  );

}


/* ============================================================
   RENDER ORDER SUMMARY
   ============================================================ */

function renderOrderSummary() {

  const container =
    document.getElementById(
      "orderSummary"
    );


  if (!container) {
    return;
  }


  const items =
    typeof getDetailedCart === "function"
      ? getDetailedCart()
      : [];


  const subtotal =
    items.reduce(
      (sum, item) => {

        return (
          sum +
          Number(
            item.subtotal || 0
          )
        );

      },
      0
    );


  if (!items.length) {

    container.innerHTML = `
      <div class="empty-state compact">
        <p>Your cart is empty.</p>
      </div>
    `;

    return;

  }


  const deliveryCharge =
    getSelectedDeliveryCharge();


  const finalTotal =
    subtotal +
    deliveryCharge;


  container.innerHTML = `

    <div class="summary-label">
      YOUR ORDER
    </div>


    <div class="order-items">

      ${items
        .map(item => {

          const name =
            typeof escapeHtml === "function"
              ? escapeHtml(
                  String(
                    item.name || ""
                  )
                )
              : String(
                  item.name || ""
                );


          const quantity =
            Number(
              item.quantity || 0
            );


          const price =
            Number(
              item.price || 0
            );


          const itemSubtotal =
            Number(
              item.subtotal || 0
            );


          const priceText =
            typeof formatBDT === "function"
              ? formatBDT(price)
              : `৳${price.toLocaleString("en-BD")}`;


          const subtotalText =
            typeof formatBDT === "function"
              ? formatBDT(itemSubtotal)
              : `৳${itemSubtotal.toLocaleString("en-BD")}`;


          return `

            <div class="order-item-row">

              <div>

                <strong>
                  ${name}
                </strong>

                <span>
                  Qty:
                  ${quantity}
                  ×
                  ${priceText}
                </span>

              </div>


              <strong>
                ${subtotalText}
              </strong>

            </div>

          `;

        })
        .join("")}

    </div>


    <div class="summary-total-line">

      <span>
        Product subtotal
      </span>


      <strong id="summarySubtotal">
        ${
          typeof formatBDT === "function"
            ? formatBDT(subtotal)
            : `৳${subtotal.toLocaleString("en-BD")}`
        }
      </strong>

    </div>


    <div class="summary-total-line">

      <span>
        Delivery charge
      </span>


      <strong id="deliveryChargeValue">

        ${
          typeof formatBDT === "function"
            ? formatBDT(deliveryCharge)
            : `৳${deliveryCharge.toLocaleString("en-BD")}`
        }

      </strong>

    </div>


    <div class="summary-grand">

      <span>
        Final total
      </span>


      <strong id="summaryFinalTotal">

        ${
          typeof formatBDT === "function"
            ? formatBDT(finalTotal)
            : `৳${finalTotal.toLocaleString("en-BD")}`
        }

      </strong>

    </div>

  `;

}


/* ============================================================
   UPDATE DELIVERY SUMMARY
   ============================================================ */

function updateDeliverySummary() {

  const area =
    getSelectedDeliveryArea();


  const charge =
    getSelectedDeliveryCharge();


  const subtotal =
    typeof getCartTotal === "function"
      ? Number(
          getCartTotal() || 0
        )
      : 0;


  const total =
    subtotal +
    charge;


  const chargeNode =
    document.getElementById(
      "deliveryChargeValue"
    );


  const finalNode =
    document.getElementById(
      "summaryFinalTotal"
    );


  if (chargeNode) {

    chargeNode.textContent =
      typeof formatBDT === "function"
        ? formatBDT(charge)
        : `৳${charge.toLocaleString("en-BD")}`;

  }


  if (finalNode) {

    finalNode.textContent =
      typeof formatBDT === "function"
        ? formatBDT(total)
        : `৳${total.toLocaleString("en-BD")}`;

  }


  /*
   * Update visual selection.
   */
  document
    .querySelectorAll(
      ".delivery-option"
    )
    .forEach(
      option => {

        const radio =
          option.querySelector(
            'input[name="deliveryArea"]'
          );


        option.classList.toggle(
          "selected",
          radio?.checked === true
        );

      }
    );


  /*
   * Clear delivery error.
   */
  const error =
    document.getElementById(
      "deliveryAreaError"
    );


  if (
    area &&
    error
  ) {

    error.textContent = "";

  }

}


/* ============================================================
   CLEAR FIELD ERROR
   ============================================================ */

function clearFieldError(
  id,
  errorId
) {

  const field =
    document.getElementById(
      id
    );


  const error =
    document.getElementById(
      errorId
    );


  field?.classList.remove(
    "invalid"
  );


  if (error) {

    error.textContent =
      "";

  }

}


/* ============================================================
   VALIDATE FORM
   ============================================================ */

function validateOrderForm() {

  let valid = true;


  const name =
    document.getElementById(
      "customerName"
    );


  const phone =
    document.getElementById(
      "phone"
    );


  const address =
    document.getElementById(
      "address"
    );


  const delivery =
    getSelectedDeliveryArea();


  /*
   * Clear errors.
   */
  [
    [
      "customerName",
      "customerNameError"
    ],
    [
      "phone",
      "phoneError"
    ],
    [
      "address",
      "addressError"
    ]

  ].forEach(
    ([id, errorId]) => {

      const field =
        document.getElementById(
          id
        );


      const error =
        document.getElementById(
          errorId
        );


      field?.classList.remove(
        "invalid"
      );


      if (error) {

        error.textContent =
          "";

      }

    }
  );


  const deliveryError =
    document.getElementById(
      "deliveryAreaError"
    );


  if (deliveryError) {

    deliveryError.textContent =
      "";

  }


  /* ----------------------------------------------------------
     NAME
     ---------------------------------------------------------- */

  const nameValue =
    name
      ? name.value.trim()
      : "";


  if (
    !name ||
    nameValue.length < 2 ||
    nameValue.length > 100
  ) {

    name?.classList.add(
      "invalid"
    );


    const error =
      document.getElementById(
        "customerNameError"
      );


    if (error) {

      error.textContent =
        "Please enter your full name.";

    }


    valid =
      false;

  }


  /* ----------------------------------------------------------
     PHONE
     ---------------------------------------------------------- */

  const phoneValue =
    phone
      ? phone.value.trim()
      : "";


  const normalizedPhone =
    phoneValue.replace(
      /[\s-]/g,
      ""
    );


  if (
    !/^(01\d{9}|\+8801\d{9})$/.test(
      normalizedPhone
    )
  ) {

    phone?.classList.add(
      "invalid"
    );


    const error =
      document.getElementById(
        "phoneError"
      );


    if (error) {

      error.textContent =
        "Enter a valid Bangladesh mobile number.";

    }


    valid =
      false;

  }


  /* ----------------------------------------------------------
     ADDRESS
     ---------------------------------------------------------- */

  const addressValue =
    address
      ? address.value.trim()
      : "";


  if (
    !address ||
    addressValue.length < 8 ||
    addressValue.length > 1000
  ) {

    address?.classList.add(
      "invalid"
    );


    const error =
      document.getElementById(
        "addressError"
      );


    if (error) {

      error.textContent =
        "Please enter your delivery address.";

    }


    valid =
      false;

  }


  /* ----------------------------------------------------------
     DELIVERY
     ---------------------------------------------------------- */

  if (
    delivery !== "inside" &&
    delivery !== "outside"
  ) {

    const error =
      document.getElementById(
        "deliveryAreaError"
      );


    if (error) {

      error.textContent =
        "Please select your delivery area.";

    }


    valid =
      false;

  }


  return valid;

}


/* ============================================================
   REQUEST ID
   ============================================================ */

function generateRequestId() {

  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      "function"
  ) {

    return window.crypto.randomUUID();

  }


  return (
    "rv-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .slice(
        2,
        12
      )
  );

}


/* ============================================================
   BUILD ORDER DATA
   ============================================================ */

function buildOrderData() {

  const items =
    typeof getDetailedCart === "function"
      ? getDetailedCart()
      : [];


  return {

    /*
     * Used to match the Apps Script response.
     */
    clientRequestId:
      generateRequestId(),


    customerName:
      document
        .getElementById(
          "customerName"
        )
        ?.value
        .trim() || "",


    phone:
      document
        .getElementById(
          "phone"
        )
        ?.value
        .trim() || "",


    address:
      document
        .getElementById(
          "address"
        )
        ?.value
        .trim() || "",


    /*
     * IMPORTANT:
     *
     * Send only the delivery area.
     *
     * Apps Script calculates the real charge.
     */
    deliveryArea:
      getSelectedDeliveryArea(),


    note:
      document
        .getElementById(
          "note"
        )
        ?.value
        .trim() || "",


    /*
     * Send only product ID + quantity.
     */
    items:
      items.map(
        item => ({

          id:
            String(
              item.id
            ),

          quantity:
            Number(
              item.quantity
            )

        })
      )

  };

}


/* ============================================================
   SHOW FORM MESSAGE
   ============================================================ */

function showFormMessage(
  message,
  isError = false
) {

  const node =
    document.getElementById(
      "formMessage"
    );


  if (!node) {
    return;
  }


  node.textContent =
    String(
      message || ""
    );


  node.classList.toggle(
    "error-state",
    Boolean(isError)
  );


  node.classList.toggle(
    "success-state",
    !isError
  );

}


/* ============================================================
   SUBMIT ORDER
   ============================================================ */

function submitOrder(event) {

  event.preventDefault();


  /*
   * Prevent duplicate click while pending.
   */
  if (
    pendingOrderSubmission
  ) {

    return;

  }


  /* ----------------------------------------------------------
     VALIDATE
     ---------------------------------------------------------- */

  if (
    !validateOrderForm()
  ) {

    return;

  }


  /* ----------------------------------------------------------
     CART CHECK
     ---------------------------------------------------------- */

  if (
    typeof getCartQuantity !== "function" ||
    getCartQuantity() <= 0
  ) {

    showFormMessage(
      "Your cart is empty.",
      true
    );

    return;

  }


  /* ----------------------------------------------------------
     SCRIPT URL
     ---------------------------------------------------------- */

  const scriptUrl =
    getConfigScriptUrl();


  /*
   * IMPORTANT:
   *
   * This checks only:
   *
   * - empty URL
   * - placeholder
   * - malformed URL
   *
   * It does NOT reject the real URL.
   */
  if (
    !isValidScriptUrl(
      scriptUrl
    )
  ) {

    showFormMessage(
      "Google Sheets is not connected correctly. Please check config.js.",
      true
    );

    return;

  }


  /* ----------------------------------------------------------
     ELEMENTS
     ---------------------------------------------------------- */

  const form =
    document.getElementById(
      "orderForm"
    );


  const iframe =
    document.getElementById(
      "orderSubmitFrame"
    );


  const button =
    document.getElementById(
      "submitOrderBtn"
    );


  if (
    !form ||
    !iframe ||
    !button
  ) {

    showFormMessage(
      "Order form is not available. Please refresh the page.",
      true
    );

    return;

  }


  /* ----------------------------------------------------------
     BUILD ORDER
     ---------------------------------------------------------- */

  const orderData =
    buildOrderData();


  const token =
    orderData.clientRequestId;


  const subtotal =
    typeof getCartTotal === "function"
      ? Number(
          getCartTotal() || 0
        )
      : 0;


  const deliveryCharge =
    getSelectedDeliveryCharge();


  /* ----------------------------------------------------------
     PENDING REQUEST
     ---------------------------------------------------------- */

  pendingOrderSubmission = {

    token:
      token,

    subtotal:
      subtotal,

    deliveryCharge:
      deliveryCharge,

    timeoutId:
      null,

    originalButtonText:
      button.textContent ||
      "Submit order"

  };


  /* ----------------------------------------------------------
     BUTTON
     ---------------------------------------------------------- */

  button.disabled =
    true;


  button.textContent =
    "Submitting…";


  showFormMessage(
    "Submitting your order…",
    false
  );


  /* ----------------------------------------------------------
     IFRAME REQUEST MARKER
     ---------------------------------------------------------- */

  iframe.dataset.activeRequest =
    token;


  /* ----------------------------------------------------------
     PAYLOAD INPUT
     ---------------------------------------------------------- */

  const payloadInput =
    document.createElement(
      "input"
    );


  payloadInput.type =
    "hidden";


  payloadInput.name =
    "payload";


  payloadInput.value =
    JSON.stringify(
      orderData
    );


  /* ----------------------------------------------------------
     SAVE FORM ATTRIBUTES
     ---------------------------------------------------------- */

  const originalAction =
    form.getAttribute(
      "action"
    );


  const originalMethod =
    form.getAttribute(
      "method"
    );


  const originalTarget =
    form.getAttribute(
      "target"
    );


  /* ----------------------------------------------------------
     SUBMIT TO IFRAME
     ---------------------------------------------------------- */

  form.appendChild(
    payloadInput
  );


  form.action =
    scriptUrl;


  form.method =
    "POST";


  form.target =
    "orderSubmitFrame";


  /*
   * Native browser submission.
   */
  form.submit();


  /* ----------------------------------------------------------
     RESTORE FORM
     ---------------------------------------------------------- */

  form.removeChild(
    payloadInput
  );


  if (
    originalAction === null
  ) {

    form.removeAttribute(
      "action"
    );

  } else {

    form.setAttribute(
      "action",
      originalAction
    );

  }


  if (
    originalMethod === null
  ) {

    form.removeAttribute(
      "method"
    );

  } else {

    form.setAttribute(
      "method",
      originalMethod
    );

  }


  if (
    originalTarget === null
  ) {

    form.removeAttribute(
      "target"
    );

  } else {

    form.setAttribute(
      "target",
      originalTarget
    );

  }


  /* ----------------------------------------------------------
     TIMEOUT
     ---------------------------------------------------------- */

  let timeoutMs =
    30000;


  if (
    typeof CONFIG !== "undefined" &&
    CONFIG &&
    Number.isFinite(
      Number(
        CONFIG.ORDER_TIMEOUT_MS
      )
    )
  ) {

    timeoutMs =
      Math.max(
        5000,
        Number(
          CONFIG.ORDER_TIMEOUT_MS
        )
      );

  }


  pendingOrderSubmission.timeoutId =
    window.setTimeout(
      () => {

        if (
          !pendingOrderSubmission ||
          pendingOrderSubmission.token !==
            token
        ) {

          return;

        }


        pendingOrderSubmission =
          null;


        delete iframe.dataset.activeRequest;


        button.disabled =
          false;


        button.textContent =
          "Submit order";


        showFormMessage(

          "We could not confirm the order response. Please check your connection. If you already received an Order ID, do not submit the order again.",

          true

        );

      },

      timeoutMs

    );

}


/* ============================================================
   HANDLE ORDER RESULT
   ============================================================ */

function handleOrderResult(
  result
) {

  if (
    !result ||
    result.type !==
      "ROVMART_ORDER_RESULT"
  ) {

    return;

  }


  /*
   * There must be an active request.
   */
  if (
    !pendingOrderSubmission
  ) {

    return;

  }


  /*
   * Must match exact request ID.
   */
  if (
    result.clientRequestId !==
    pendingOrderSubmission.token
  ) {

    return;

  }


  const pending =
    pendingOrderSubmission;


  pendingOrderSubmission =
    null;


  window.clearTimeout(
    pending.timeoutId
  );


  /*
   * Remove active request marker.
   */
  const iframe =
    document.getElementById(
      "orderSubmitFrame"
    );


  if (iframe) {

    delete iframe.dataset.activeRequest;

  }


  /* ----------------------------------------------------------
     RESTORE BUTTON
     ---------------------------------------------------------- */

  const button =
    document.getElementById(
      "submitOrderBtn"
    );


  if (button) {

    button.disabled =
      false;


    button.textContent =
      pending.originalButtonText ||
      "Submit order";

  }


  /* ----------------------------------------------------------
     SERVER ERROR
     ---------------------------------------------------------- */

  if (
    !result.success
  ) {

    showFormMessage(

      result.message ||
        "Something went wrong while placing your order.",

      true

    );

    return;

  }


  /* ----------------------------------------------------------
     SUCCESS
     ---------------------------------------------------------- */

  if (
    typeof clearCart === "function"
  ) {

    clearCart();

  }


  showOrderSuccess(
    result
  );

}


/* ============================================================
   ORDER SUCCESS
   ============================================================ */

function showOrderSuccess(
  result
) {

  const content =
    document.getElementById(
      "orderContent"
    );


  if (!content) {
    return;
  }


  const orderId =
    String(
      result.orderId ||
      "—"
    );


  const subtotal =
    Number(
      result.subtotal ||
      0
    );


  const deliveryCharge =
    Number(
      result.deliveryCharge ||
      0
    );


  const total =
    Number(
      result.total ||
      0
    );


  const safeOrderId =
    typeof escapeHtml === "function"
      ? escapeHtml(
          orderId
        )
      : orderId;


  function money(
    amount
  ) {

    return typeof formatBDT === "function"
      ? formatBDT(amount)
      : `৳${amount.toLocaleString("en-BD")}`;

  }


  content.innerHTML = `

    <div class="success-screen">

      <div
        class="success-mark"
        aria-hidden="true"
      >
        ✓
      </div>


      <p class="eyebrow">
        ORDER CONFIRMED
      </p>


      <h2>
        Thank you for your order.
      </h2>


      <p class="success-copy">
        Your order has been received successfully.
        Keep your Order ID for future reference.
      </p>


      <div class="order-id-card">

        <span>
          Order ID
        </span>


        <strong>
          ${safeOrderId}
        </strong>

      </div>


      <div class="success-summary">

        <div>

          <span>
            Products
          </span>

          <strong>
            ${money(subtotal)}
          </strong>

        </div>


        <div>

          <span>
            Delivery
          </span>

          <strong>
            ${money(deliveryCharge)}
          </strong>

        </div>


        <div>

          <span>
            Total
          </span>

          <strong>
            ${money(total)}
          </strong>

        </div>

      </div>


      <button
        type="button"
        class="button button-dark full"
        id="continueShoppingBtn"
      >
        Continue shopping
      </button>

    </div>

  `;


  document
    .getElementById(
      "continueShoppingBtn"
    )
    ?.addEventListener(
      "click",
      () => {

        const modal =
          document.getElementById(
            "orderModal"
          );


        modal?.classList.add(
          "hidden"
        );


        modal?.setAttribute(
          "aria-hidden",
          "true"
        );


        document.body.classList.remove(
          "no-scroll"
        );


        window.location.href =
          "index.html#shop";

      }
    );

}


/* ============================================================
   CREATE ORDER FORM MARKUP
   ============================================================ */

function createOrderFormMarkup() {

  return `

    <p class="eyebrow">
      CHECKOUT
    </p>


    <h2 id="orderTitle">
      Complete your order
    </h2>


    <div
      id="orderSummary"
      class="order-summary"
    ></div>


    <form
      id="orderForm"
      novalidate
    >

      <div class="field">

        <label for="customerName">
          Full name
          <span>*</span>
        </label>


        <input
          id="customerName"
          name="customerName"
          type="text"
          autocomplete="name"
          maxlength="100"
          required
        />


        <small
          class="error"
          id="customerNameError"
        ></small>

      </div>


      <div class="field">

        <label for="phone">
          Phone number
          <span>*</span>
        </label>


        <input
          id="phone"
          name="phone"
          type="tel"
          inputmode="tel"
          autocomplete="tel"
          placeholder="01XXXXXXXXX"
          maxlength="14"
          required
        />


        <small
          class="error"
          id="phoneError"
        ></small>

      </div>


      <div class="field">

        <label>
          Delivery area
          <span>*</span>
        </label>


        <div class="delivery-options">

          <label class="delivery-option">

            <input
              type="radio"
              name="deliveryArea"
              value="inside"
            />


            <span>

              <strong>
                Inside Dhaka
              </strong>

              <small>
                Delivery ৳50
              </small>

            </span>

          </label>


          <label class="delivery-option">

            <input
              type="radio"
              name="deliveryArea"
              value="outside"
            />


            <span>

              <strong>
                Outside Dhaka
              </strong>

              <small>
                Delivery ৳100
              </small>

            </span>

          </label>

        </div>


        <small
          class="error"
          id="deliveryAreaError"
        ></small>

      </div>


      <div class="field">

        <label for="address">
          Delivery address
          <span>*</span>
        </label>


        <textarea
          id="address"
          name="address"
          rows="4"
          maxlength="1000"
          autocomplete="street-address"
          required
        ></textarea>


        <small
          class="error"
          id="addressError"
        ></small>

      </div>


      <div class="field">

        <label for="note">

          Additional note

          <span>
            (optional)
          </span>

        </label>


        <textarea
          id="note"
          name="note"
          rows="2"
          maxlength="1000"
        ></textarea>

      </div>


      <button
        class="button button-dark full"
        id="submitOrderBtn"
        type="submit"
      >
        Submit order
      </button>


      <p
        id="formMessage"
        class="form-message"
        role="alert"
        aria-live="polite"
      ></p>

    </form>

  `;

}


/* ============================================================
   RESET ORDER CONTENT
   ============================================================ */

function resetOrderContent() {

  const content =
    document.getElementById(
      "orderContent"
    );


  if (!content) {
    return;
  }


  content.innerHTML =
    createOrderFormMarkup();


  bindOrderFormEvents();

  renderOrderSummary();

  updateDeliverySummary();

}


/* ============================================================
   BIND EVENTS
   ============================================================ */

function bindOrderFormEvents() {

  const form =
    document.getElementById(
      "orderForm"
    );


  /*
   * Prevent duplicate listeners.
   */
  if (
    form &&
    form.dataset.orderBound !==
      "true"
  ) {

    form.addEventListener(
      "submit",
      submitOrder
    );


    form.dataset.orderBound =
      "true";

  }


  /*
   * Delivery radios.
   */
  document
    .querySelectorAll(
      'input[name="deliveryArea"]'
    )
    .forEach(
      input => {

        if (
          input.dataset.deliveryBound ===
          "true"
        ) {

          return;

        }


        input.addEventListener(
          "change",
          () => {

            updateDeliverySummary();


            const error =
              document.getElementById(
                "deliveryAreaError"
              );


            if (error) {

              error.textContent =
                "";

            }

          }
        );


        input.dataset.deliveryBound =
          "true";

      }
    );


  /*
   * Clear field errors.
   */
  [
    [
      "customerName",
      "customerNameError"
    ],
    [
      "phone",
      "phoneError"
    ],
    [
      "address",
      "addressError"
    ]

  ].forEach(
    ([id, errorId]) => {

      const field =
        document.getElementById(
          id
        );


      if (
        !field ||
        field.dataset.errorBound ===
          "true"
      ) {

        return;

      }


      field.addEventListener(
        "input",
        () => {

          clearFieldError(
            id,
            errorId
          );

        }
      );


      field.dataset.errorBound =
        "true";

    }
  );

}


/* ============================================================
   ENSURE ORDER FORM
   ============================================================ */

function ensureOrderForm() {

  const form =
    document.getElementById(
      "orderForm"
    );


  if (!form) {

    resetOrderContent();

    return;

  }


  bindOrderFormEvents();

}


/* ============================================================
   MESSAGE FROM APPS SCRIPT IFRAME
   ============================================================ */

window.addEventListener(
  "message",
  event => {

    /*
     * The message is coming FROM the Apps Script iframe.
     *
     * Therefore event.origin is NOT the GitHub Pages origin.
     *
     * We validate the sender using:
     *
     * 1. Expected Google origin
     * 2. Actual iframe window
     * 3. Message type
     * 4. Matching clientRequestId
     */


    const iframe =
      document.getElementById(
        "orderSubmitFrame"
      );


    /*
     * If iframe doesn't exist,
     * ignore message.
     */
    if (
      !iframe ||
      !iframe.contentWindow
    ) {

      return;

    }


    /*
     * Message must come from our
     * order-submit iframe.
     */
    if (
      event.source !==
      iframe.contentWindow
    ) {

      return;

    }


    /*
     * Apps Script responses can involve
     * Google script/googleusercontent origins.
     */
    const allowedOrigins = [

      "https://script.google.com",

      "https://script.googleusercontent.com"

    ];


    if (
      !allowedOrigins.includes(
        event.origin
      )
    ) {

      return;

    }


    const result =
      event.data;


    if (
      !result ||
      result.type !==
        "ROVMART_ORDER_RESULT"
    ) {

      return;

    }


    handleOrderResult(
      result
    );

  }
);


/* ============================================================
   INITIALIZE
   ============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    bindOrderFormEvents();


    document
      .getElementById(
        "closeOrderBtn"
      )
      ?.addEventListener(
        "click",
        closeOrderModal
      );


    document
      .getElementById(
        "orderModal"
      )
      ?.addEventListener(
        "click",
        event => {

          if (
            event.target.id ===
            "orderModal"
          ) {

            closeOrderModal();

          }

        }
      );

  }
);
