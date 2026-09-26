/*
 * ============================================================
 * ROVMART - Order / Checkout Flow
 * ============================================================
 *
 * Submission architecture:
 *
 * Customer
 *    ↓
 * order.js
 *    ↓
 * Native HTML Form POST
 *    ↓
 * Google Apps Script Web App
 *    ↓
 * Google Sheets
 *    ↓
 * HTML response in hidden iframe
 *    ↓
 * postMessage()
 *    ↓
 * order.js
 *    ↓
 * Order success screen
 *
 * IMPORTANT:
 * - Browser sends only delivery area.
 * - Browser does NOT decide delivery charge.
 * - Google Apps Script calculates the authoritative total.
 * ============================================================
 */


/* ============================================================
   STATE
   ============================================================ */

let pendingOrderSubmission = null;


/* ============================================================
   DELIVERY
   ============================================================ */

/**
 * Get selected delivery area.
 *
 * Returns:
 *   "inside"
 *   "outside"
 *   ""
 */
function getSelectedDeliveryArea() {

  return (
    document.querySelector(
      'input[name="deliveryArea"]:checked'
    )?.value || ""
  );

}


/**
 * Get frontend display delivery charge.
 *
 * IMPORTANT:
 * This is only for the UI.
 *
 * Google Apps Script calculates the real charge
 * when the order is submitted.
 */
function getSelectedDeliveryCharge() {

  const area =
    getSelectedDeliveryArea();

  if (
    typeof CONFIG !== "object" ||
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


  /*
   * Close cart drawer before opening checkout.
   */
  if (
    typeof closeCartDrawer === "function"
  ) {
    closeCartDrawer();
  }


  const modal =
    document.getElementById(
      "orderModal"
    );


  if (!modal) return;


  /*
   * No previous request should remain.
   */
  pendingOrderSubmission = null;


  /*
   * Make modal visible.
   */
  modal.classList.remove("hidden");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.classList.add(
    "no-scroll"
  );


  /*
   * Render current order.
   */
  renderOrderSummary();

  updateDeliverySummary();


  /*
   * Focus customer name.
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
   * Do not let the customer close the modal
   * while an order is actively submitting.
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


  if (!modal) return;


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
      (sum, item) =>
        sum +
        Number(item.subtotal || 0),
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
                  String(item.name || "")
                )
              : String(item.name || "");

          const quantity =
            Number(item.quantity || 0);

          const price =
            Number(item.price || 0);

          const itemSubtotal =
            Number(item.subtotal || 0);

          const formattedPrice =
            typeof formatBDT === "function"
              ? formatBDT(price)
              : `৳${price.toLocaleString()}`;

          const formattedSubtotal =
            typeof formatBDT === "function"
              ? formatBDT(itemSubtotal)
              : `৳${itemSubtotal.toLocaleString()}`;

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
                  ${formattedPrice}
                </span>

              </div>

              <strong>
                ${formattedSubtotal}
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
            : `৳${subtotal.toLocaleString()}`
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
            : `৳${deliveryCharge.toLocaleString()}`
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
            : `৳${finalTotal.toLocaleString()}`
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
      ? Number(getCartTotal() || 0)
      : 0;


  const finalTotal =
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
        : `৳${charge.toLocaleString()}`;

  }


  if (finalNode) {

    finalNode.textContent =
      typeof formatBDT === "function"
        ? formatBDT(finalTotal)
        : `৳${finalTotal.toLocaleString()}`;

  }


  /*
   * Update selected visual state.
   */
  document
    .querySelectorAll(
      ".delivery-option"
    )
    .forEach(option => {

      const radio =
        option.querySelector(
          'input[name="deliveryArea"]'
        );

      option.classList.toggle(
        "selected",
        radio?.checked === true
      );

    });


  /*
   * Clear delivery error when selected.
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
   FIELD ERROR
   ============================================================ */

function clearFieldError(
  id,
  errorId
) {

  const field =
    document.getElementById(id);


  const error =
    document.getElementById(
      errorId
    );


  field?.classList.remove(
    "invalid"
  );


  if (error) {
    error.textContent = "";
  }

}


/* ============================================================
   VALIDATE ORDER FORM
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
   * Clear previous field errors.
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
        document.getElementById(id);

      const error =
        document.getElementById(
          errorId
        );

      field?.classList.remove(
        "invalid"
      );

      if (error) {
        error.textContent = "";
      }

    }
  );


  const deliveryError =
    document.getElementById(
      "deliveryAreaError"
    );


  if (deliveryError) {
    deliveryError.textContent = "";
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


    valid = false;

  }


  /* ----------------------------------------------------------
     PHONE
     ---------------------------------------------------------- */

  const rawPhone =
    phone
      ? phone.value.trim()
      : "";


  const normalizedPhone =
    rawPhone.replace(
      /[\s-]/g,
      ""
    );


  /*
   * Bangladesh mobile formats:
   *
   * 01712345678
   * +8801712345678
   */
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


    valid = false;

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


    valid = false;

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


    valid = false;

  }


  return valid;

}


/* ============================================================
   GENERATE CLIENT REQUEST ID
   ============================================================ */

function generateRequestId() {

  /*
   * Prefer browser crypto UUID.
   */
  if (
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {

    return window.crypto.randomUUID();

  }


  /*
   * Fallback.
   */
  return (
    `rv-` +
    Date.now() +
    `-` +
    Math.random()
      .toString(36)
      .slice(2, 12)
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
     * Used to match the browser request
     * to the Apps Script response.
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
     * Only the area is sent.
     *
     * Server determines actual delivery charge.
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


    items:
      items.map(
        item => ({

          id:
            item.id,

          quantity:
            Number(
              item.quantity
            )

        })
      )

  };

}


/* ============================================================
   CHECK SCRIPT URL
   ============================================================ */

function isValidScriptUrl(
  url
) {

  if (!url) {
    return false;
  }


  /*
   * Reject configuration placeholder.
   */
  if (
    url.includes(
      "https://script.google.com/macros/s/AKfycbwnsVrgr8QMmOjG-PF84KgxpUxUm-oBewOojJLKWDsG6InOyjcClAL30gezh0Eo6rmT6w/exec"
    )
  ) {

    return false;

  }


  /*
   * Expected Google Apps Script
   * web app URL.
   */
  return (
    /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/
      .test(url)
  );

}


/* ============================================================
   SUBMIT ORDER
   ============================================================ */

function submitOrder(event) {

  event.preventDefault();


  /*
   * Prevent second submission while
   * first request is active.
   */
  if (
    pendingOrderSubmission
  ) {

    return;

  }


  /* ----------------------------------------------------------
     FORM VALIDATION
     ---------------------------------------------------------- */

  if (
    !validateOrderForm()
  ) {

    return;

  }


  /* ----------------------------------------------------------
     CART VALIDATION
     ---------------------------------------------------------- */

  if (
    typeof getCartQuantity !== "function" ||
    getCartQuantity() === 0
  ) {

    showFormMessage(
      "Your cart is empty.",
      true
    );

    return;

  }


  /* ----------------------------------------------------------
     GOOGLE APPS SCRIPT URL
     ---------------------------------------------------------- */

  const scriptUrl =
    String(
      CONFIG?.GOOGLE_SCRIPT_URL || ""
    ).trim();


  /*
   * IMPORTANT:
   *
   * Only reject when the URL is actually
   * empty, placeholder, or malformed.
   *
   * Do NOT compare against the real URL.
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
     REQUIRED DOM ELEMENTS
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
      "The order form is not available. Please refresh the page and try again.",
      true
    );

    return;

  }


  /* ----------------------------------------------------------
     BUILD DATA
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
     SAVE PENDING STATE
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
     DISABLE BUTTON
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
     MARK ACTIVE REQUEST
     ---------------------------------------------------------- */

  iframe.dataset.activeRequest =
    token;


  /* ----------------------------------------------------------
     CREATE HIDDEN PAYLOAD INPUT
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
     PRESERVE FORM ATTRIBUTES
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
     SUBMIT
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
   * Native form submission.
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
     RESPONSE TIMEOUT
     ---------------------------------------------------------- */

  const timeoutMs =
    Number(
      CONFIG?.ORDER_TIMEOUT_MS || 30000
    );


  pendingOrderSubmission.timeoutId =
    window.setTimeout(
      () => {

        if (
          !pendingOrderSubmission ||
          pendingOrderSubmission.token !== token
        ) {

          return;

        }


        pendingOrderSubmission =
          null;


        button.disabled =
          false;


        button.textContent =
          "Submit order";


        showFormMessage(

          "We could not confirm the order response. Please check your connection and try again. If you already received an Order ID, do not submit again.",

          true

        );

      },
      timeoutMs
    );

}


/* ============================================================
   FORM MESSAGE
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
    message;


  node.classList.toggle(
    "error-state",
    isError
  );


  node.classList.toggle(
    "success-state",
    !isError
  );

}


/* ============================================================
   HANDLE APPS SCRIPT RESULT
   ============================================================ */

function handleOrderResult(
  result
) {

  /*
   * Verify message type.
   */
  if (
    !result ||
    result.type !==
      "ROVMART_ORDER_RESULT"
  ) {

    return;

  }


  /*
   * A response without an active submission
   * should be ignored.
   */
  if (
    !pendingOrderSubmission
  ) {

    return;

  }


  /*
   * Only accept the response belonging
   * to this exact browser request.
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
   * Clear iframe request marker.
   */
  const iframe =
    document.getElementById(
      "orderSubmitFrame"
    );


  if (iframe) {

    delete iframe.dataset.activeRequest;

  }


  /*
   * Restore button.
   */
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
     FAILURE
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
   SUCCESS SCREEN
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
      result.orderId || "—"
    );


  const subtotal =
    Number(
      result.subtotal || 0
    );


  const deliveryCharge =
    Number(
      result.deliveryCharge || 0
    );


  const total =
    Number(
      result.total || 0
    );


  const safeOrderId =
    typeof escapeHtml === "function"
      ? escapeHtml(orderId)
      : orderId;


  const formatMoney =
    amount =>
      typeof formatBDT === "function"
        ? formatBDT(amount)
        : `৳${amount.toLocaleString()}`;


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
            ${formatMoney(subtotal)}
          </strong>
        </div>


        <div>
          <span>
            Delivery
          </span>

          <strong>
            ${formatMoney(deliveryCharge)}
          </strong>
        </div>


        <div>
          <span>
            Total
          </span>

          <strong>
            ${formatMoney(total)}
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


        /*
         * Go back to product shop.
         */
        window.location.href =
          "index.html#shop";

      }
    );

}


/* ============================================================
   REBUILD ORDER FORM
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
   ORDER FORM HTML
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

      <!-- NAME -->

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


      <!-- PHONE -->

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


      <!-- DELIVERY AREA -->

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


      <!-- ADDRESS -->

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


      <!-- NOTE -->

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


      <!-- SUBMIT -->

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
   BIND ORDER FORM EVENTS
   ============================================================ */

function bindOrderFormEvents() {

  const form =
    document.getElementById(
      "orderForm"
    );


  /*
   * Avoid duplicate form submit listeners.
   */
  if (
    form &&
    form.dataset.orderBound !== "true"
  ) {

    form.addEventListener(
      "submit",
      submitOrder
    );


    form.dataset.orderBound =
      "true";

  }


  /*
   * Delivery radio buttons.
   */
  document
    .querySelectorAll(
      'input[name="deliveryArea"]'
    )
    .forEach(input => {

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

            error.textContent = "";

          }

        }
      );


      input.dataset.deliveryBound =
        "true";

    });


  /*
   * Clear errors while typing.
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
        document.getElementById(id);


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
   ENSURE FORM EXISTS
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
   MESSAGE EVENT
   ============================================================ */

window.addEventListener(
  "message",
  event => {

    /*
     * Security:
     *
     * Only accept messages from our GitHub Pages origin.
     *
     * Apps Script iframe sends this result back to
     * the parent GitHub Pages document.
     */
    if (
      event.origin !==
      "https://mdparvezmussaruf.github.io"
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
