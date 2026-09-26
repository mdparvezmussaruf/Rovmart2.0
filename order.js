/* ROVMART order flow: native form -> hidden iframe -> postMessage */
let pendingOrderSubmission = null;

function getSelectedDeliveryArea() {
  return document.querySelector('input[name="deliveryArea"]:checked')?.value || "";
}

function getSelectedDeliveryCharge() {
  const area = getSelectedDeliveryArea();
  return CONFIG.DELIVERY_CHARGES[area] ?? 0;
}

function openOrderModal() {
  if (getCartQuantity() === 0) {
    showToast("Your cart is empty.");
    return;
  }

  closeCartDrawer();
  const modal = document.getElementById("orderModal");
  if (!modal) return;

  pendingOrderSubmission = null;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
  renderOrderSummary();
  updateDeliverySummary();

  document.getElementById("customerName")?.focus();
}

function closeOrderModal() {
  const modal = document.getElementById("orderModal");
  if (!modal) return;
  if (pendingOrderSubmission) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

function renderOrderSummary() {
  const container = document.getElementById("orderSummary");
  if (!container) return;

  const items = getDetailedCart();
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  if (!items.length) {
    container.innerHTML = `<div class="empty-state compact"><p>Your cart is empty.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="summary-label">YOUR ORDER</div>
    <div class="order-items">
      ${items.map(item => `
        <div class="order-item-row">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>Qty: ${item.quantity} × ${formatBDT(item.price)}</span>
          </div>
          <strong>${formatBDT(item.subtotal)}</strong>
        </div>`).join("")}
    </div>
    <div class="summary-total-line"><span>Product subtotal</span><strong id="summarySubtotal">${formatBDT(subtotal)}</strong></div>
    <div class="summary-total-line"><span>Delivery charge</span><strong id="deliveryChargeValue">${formatBDT(getSelectedDeliveryCharge())}</strong></div>
    <div class="summary-grand"><span>Final total</span><strong id="summaryFinalTotal">${formatBDT(subtotal + getSelectedDeliveryCharge())}</strong></div>
  `;
}

function updateDeliverySummary() {
  const area = getSelectedDeliveryArea();
  const charge = getSelectedDeliveryCharge();
  const subtotal = getCartTotal();

  const chargeNode = document.getElementById("deliveryChargeValue");
  const finalNode = document.getElementById("summaryFinalTotal");
  if (chargeNode) chargeNode.textContent = formatBDT(charge);
  if (finalNode) finalNode.textContent = formatBDT(subtotal + charge);

  document.querySelectorAll(".delivery-option").forEach(option => {
    option.classList.toggle("selected", option.querySelector('input[name="deliveryArea"]')?.checked === true);
  });

  const error = document.getElementById("deliveryAreaError");
  if (area && error) error.textContent = "";
}

function clearFieldError(id, errorId) {
  const field = document.getElementById(id);
  const error = document.getElementById(errorId);
  field?.classList.remove("invalid");
  if (error) error.textContent = "";
}

function validateOrderForm() {
  let valid = true;
  const name = document.getElementById("customerName");
  const phone = document.getElementById("phone");
  const address = document.getElementById("address");
  const delivery = getSelectedDeliveryArea();

  [
    ["customerName", "customerNameError"],
    ["phone", "phoneError"],
    ["address", "addressError"]
  ].forEach(([id, errorId]) => {
    const field = document.getElementById(id);
    const error = document.getElementById(errorId);
    field?.classList.remove("invalid");
    if (error) error.textContent = "";
  });
  document.getElementById("deliveryAreaError")?.replaceChildren();

  if (!name || name.value.trim().length < 2 || name.value.trim().length > 100) {
    name?.classList.add("invalid");
    const error = document.getElementById("customerNameError");
    if (error) error.textContent = "Please enter your full name.";
    valid = false;
  }

  const normalizedPhone = phone ? phone.value.replace(/[\s-]/g, "") : "";
  if (!/^(01\d{9}|\+8801\d{9})$/.test(normalizedPhone)) {
    phone?.classList.add("invalid");
    const error = document.getElementById("phoneError");
    if (error) error.textContent = "Enter a valid Bangladesh mobile number.";
    valid = false;
  }

  if (!address || address.value.trim().length < 8 || address.value.trim().length > 1000) {
    address?.classList.add("invalid");
    const error = document.getElementById("addressError");
    if (error) error.textContent = "Please enter your delivery address.";
    valid = false;
  }

  if (delivery !== "inside" && delivery !== "outside") {
    const error = document.getElementById("deliveryAreaError");
    if (error) error.textContent = "Please select your delivery area.";
    valid = false;
  }

  return valid;
}

function generateRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `rv-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function buildOrderData() {
  const items = getDetailedCart();
  return {
    clientRequestId: generateRequestId(),
    customerName: document.getElementById("customerName")?.value.trim() || "",
    phone: document.getElementById("phone")?.value.trim() || "",
    address: document.getElementById("address")?.value.trim() || "",
    deliveryArea: getSelectedDeliveryArea(),
    note: document.getElementById("note")?.value.trim() || "",
    items: items.map(item => ({ id: item.id, quantity: item.quantity }))
  };
}

function submitOrder(event) {
  event.preventDefault();
  if (pendingOrderSubmission) return;

  if (!validateOrderForm()) return;
  if (getCartQuantity() === 0) {
    showFormMessage("Your cart is empty.", true);
    return;
  }

  const scriptUrl = String(CONFIG.GOOGLE_SCRIPT_URL || "").trim();
  if (!scriptUrl || scriptUrl.includes("PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE")) {
    showFormMessage("Add your Google Apps Script Web App URL in config.js before submitting.", true);
    return;
  }

  const form = document.getElementById("orderForm");
  const iframe = document.getElementById("orderSubmitFrame");
  const button = document.getElementById("submitOrderBtn");
  if (!form || !iframe || !button) return;

  const orderData = buildOrderData();
  const token = orderData.clientRequestId;
  const subtotal = getCartTotal();
  const deliveryCharge = getSelectedDeliveryCharge();

  pendingOrderSubmission = {
    token,
    subtotal,
    deliveryCharge,
    timeoutId: null,
    originalButtonText: button.textContent
  };

  button.disabled = true;
  button.textContent = "Submitting…";
  showFormMessage("Submitting your order…", false);

  iframe.dataset.activeRequest = token;

  const payloadInput = document.createElement("input");
  payloadInput.type = "hidden";
  payloadInput.name = "payload";
  payloadInput.value = JSON.stringify(orderData);

  const originalAction = form.getAttribute("action");
  const originalMethod = form.getAttribute("method");
  const originalTarget = form.getAttribute("target");

  form.appendChild(payloadInput);
  form.action = scriptUrl;
  form.method = "POST";
  form.target = "orderSubmitFrame";
  form.submit();

  form.removeChild(payloadInput);
  if (originalAction === null) form.removeAttribute("action"); else form.setAttribute("action", originalAction);
  if (originalMethod === null) form.removeAttribute("method"); else form.setAttribute("method", originalMethod);
  if (originalTarget === null) form.removeAttribute("target"); else form.setAttribute("target", originalTarget);

  pendingOrderSubmission.timeoutId = window.setTimeout(() => {
    if (!pendingOrderSubmission || pendingOrderSubmission.token !== token) return;
    pendingOrderSubmission = null;
    button.disabled = false;
    button.textContent = "Submit order";
    showFormMessage("We could not confirm the order response. Please check your connection and try again. If you already received an Order ID, do not submit again.", true);
  }, CONFIG.ORDER_TIMEOUT_MS);
}

function showFormMessage(message, isError = false) {
  const node = document.getElementById("formMessage");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("error-state", isError);
  node.classList.toggle("success-state", !isError);
}

function handleOrderResult(result) {
  if (!result || result.type !== "ROVMART_ORDER_RESULT") return;
  if (!pendingOrderSubmission || result.clientRequestId !== pendingOrderSubmission.token) return;

  const pending = pendingOrderSubmission;
  pendingOrderSubmission = null;
  window.clearTimeout(pending.timeoutId);

  const button = document.getElementById("submitOrderBtn");
  if (button) {
    button.disabled = false;
    button.textContent = "Submit order";
  }

  if (!result.success) {
    showFormMessage(result.message || "Something went wrong while placing your order.", true);
    return;
  }

  clearCart();
  showOrderSuccess(result);
}

function showOrderSuccess(result) {
  const content = document.getElementById("orderContent");
  if (!content) return;

  content.innerHTML = `
    <div class="success-screen">
      <div class="success-mark" aria-hidden="true">✓</div>
      <p class="eyebrow">ORDER CONFIRMED</p>
      <h2>Thank you for your order.</h2>
      <p class="success-copy">Your order has been received successfully. Keep your Order ID for future reference.</p>
      <div class="order-id-card">
        <span>Order ID</span>
        <strong>${escapeHtml(result.orderId || "—")}</strong>
      </div>
      <div class="success-summary">
        <div><span>Products</span><strong>${formatBDT(result.subtotal || 0)}</strong></div>
        <div><span>Delivery</span><strong>${formatBDT(result.deliveryCharge || 0)}</strong></div>
        <div><span>Total</span><strong>${formatBDT(result.total || 0)}</strong></div>
      </div>
      <button type="button" class="button button-dark full" id="continueShoppingBtn">Continue shopping</button>
    </div>
  `;

  document.getElementById("continueShoppingBtn")?.addEventListener("click", () => {
    const modal = document.getElementById("orderModal");
    modal?.classList.add("hidden");
    modal?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    window.location.href = "index.html#shop";
  });
}

function resetOrderContent() {
  const content = document.getElementById("orderContent");
  if (!content) return;
  content.innerHTML = createOrderFormMarkup();
  bindOrderFormEvents();
  renderOrderSummary();
  updateDeliverySummary();
}

function createOrderFormMarkup() {
  return `
    <p class="eyebrow">CHECKOUT</p>
    <h2 id="orderTitle">Complete your order</h2>
    <div id="orderSummary" class="order-summary"></div>
    <form id="orderForm" novalidate>
      <div class="field">
        <label for="customerName">Full name <span>*</span></label>
        <input id="customerName" name="customerName" autocomplete="name" required>
        <small class="error" id="customerNameError"></small>
      </div>
      <div class="field">
        <label for="phone">Phone number <span>*</span></label>
        <input id="phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="01XXXXXXXXX" required>
        <small class="error" id="phoneError"></small>
      </div>
      <div class="field">
        <label>Delivery area <span>*</span></label>
        <div class="delivery-options">
          <label class="delivery-option">
            <input type="radio" name="deliveryArea" value="inside">
            <span><strong>Inside Dhaka</strong><small>Delivery ৳50</small></span>
          </label>
          <label class="delivery-option">
            <input type="radio" name="deliveryArea" value="outside">
            <span><strong>Outside Dhaka</strong><small>Delivery ৳100</small></span>
          </label>
        </div>
        <small class="error" id="deliveryAreaError"></small>
      </div>
      <div class="field">
        <label for="address">Delivery address <span>*</span></label>
        <textarea id="address" name="address" rows="4" autocomplete="street-address" required></textarea>
        <small class="error" id="addressError"></small>
      </div>
      <div class="field">
        <label for="note">Additional note <span>(optional)</span></label>
        <textarea id="note" name="note" rows="2"></textarea>
      </div>
      <button class="button button-dark full" id="submitOrderBtn" type="submit">Submit order</button>
      <p id="formMessage" class="form-message" role="alert"></p>
    </form>
  `;
}

function bindOrderFormEvents() {
  document.getElementById("orderForm")?.addEventListener("submit", submitOrder);
  document.querySelectorAll('input[name="deliveryArea"]').forEach(input => {
    input.addEventListener("change", updateDeliverySummary);
  });
  [
    ["customerName", "customerNameError"],
    ["phone", "phoneError"],
    ["address", "addressError"]
  ].forEach(([id, errorId]) => {
    document.getElementById(id)?.addEventListener("input", () => clearFieldError(id, errorId));
  });
}

function ensureOrderForm() {
  const form = document.getElementById("orderForm");
  if (!form) {
    resetOrderContent();
    return;
  }
  bindOrderFormEvents();
}

window.addEventListener("message", event => {
  const result = event.data;
  if (!result || result.type !== "ROVMART_ORDER_RESULT") return;
  handleOrderResult(result);
});

document.addEventListener("DOMContentLoaded", () => {
  bindOrderFormEvents();
  document.getElementById("closeOrderBtn")?.addEventListener("click", closeOrderModal);
  document.getElementById("orderModal")?.addEventListener("click", event => {
    if (event.target.id === "orderModal") closeOrderModal();
  });
});
