/* ROVMART cart state */
const CART_KEY = "noire_fashion_cart";
const MAX_QUANTITY = 99;

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const cart = raw ? JSON.parse(raw) : [];
    return Array.isArray(cart) ? cart : [];
  } catch (error) {
    console.warn("Could not read cart.", error);
    return [];
  }
}

function saveCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn("Could not save cart.", error);
  }
  renderCartUI();
}

function cleanCart() {
  const validIds = new Set(products.map(product => product.id));
  const current = getCart();
  const cleaned = [];
  let changed = false;

  for (const item of current) {
    if (!item || !validIds.has(item.id)) {
      changed = true;
      continue;
    }
    const quantity = Number.parseInt(item.quantity, 10);
    const safeQuantity = Number.isFinite(quantity) ? Math.min(MAX_QUANTITY, Math.max(1, quantity)) : 1;
    if (safeQuantity !== quantity) changed = true;
    cleaned.push({ id: item.id, quantity: safeQuantity });
  }

  if (changed || cleaned.length !== current.length) {
    saveCart(cleaned);
  }
  return cleaned;
}

function addToCart(productId, quantity = 1) {
  const product = products.find(item => item.id === productId && item.available);
  if (!product) {
    showToast("That product is unavailable.");
    return false;
  }

  const parsed = Number.parseInt(quantity, 10);
  const amount = Number.isFinite(parsed) ? Math.min(MAX_QUANTITY, Math.max(1, parsed)) : 1;
  const cart = getCart();
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + amount);
  } else {
    cart.push({ id: productId, quantity: amount });
  }

  saveCart(cart);
  showToast(`${product.name} added to cart.`);
  return true;
}

function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find(entry => entry.id === productId);
  if (!item) return;

  const parsed = Number.parseInt(quantity, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    removeFromCart(productId);
    return;
  }

  item.quantity = Math.min(MAX_QUANTITY, parsed);
  saveCart(cart);
}

function removeFromCart(productId) {
  const product = products.find(item => item.id === productId);
  const next = getCart().filter(item => item.id !== productId);
  saveCart(next);
  if (product) showToast(`${product.name} removed.`);
}

function getDetailedCart() {
  return getCart()
    .map(item => {
      const product = products.find(entry => entry.id === item.id);
      if (!product) return null;
      const quantity = Math.min(MAX_QUANTITY, Math.max(1, Number(item.quantity) || 1));
      return {
        ...product,
        quantity,
        subtotal: product.price * quantity
      };
    })
    .filter(Boolean);
}

function getCartQuantity() {
  return getCart().reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

function getCartTotal() {
  return getDetailedCart().reduce((total, item) => total + item.subtotal, 0);
}

function clearCart() {
  saveCart([]);
}

function formatBDT(value) {
  const amount = Number(value) || 0;
  return `৳${amount.toLocaleString("en-BD")}`;
}

function renderCartUI() {
  const detailed = getDetailedCart();
  const quantity = detailed.reduce((total, item) => total + item.quantity, 0);
  const total = detailed.reduce((sum, item) => sum + item.subtotal, 0);

  document.querySelectorAll("#headerCartCount").forEach(node => {
    node.textContent = String(quantity);
  });

  const floating = document.getElementById("floatingCart");
  if (floating) floating.classList.toggle("hidden", quantity === 0);

  const floatingQuantity = document.getElementById("floatingQuantity");
  const floatingTotal = document.getElementById("floatingTotal");
  if (floatingQuantity) floatingQuantity.textContent = String(quantity);
  if (floatingTotal) floatingTotal.textContent = formatBDT(total);

  const drawerTotal = document.getElementById("drawerTotal");
  if (drawerTotal) drawerTotal.textContent = formatBDT(total);

  const itemsContainer = document.getElementById("cartItems");
  if (itemsContainer) {
    if (!detailed.length) {
      itemsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◌</div>
          <h3>Your cart is empty</h3>
          <p>Add a piece from the collection to begin.</p>
        </div>`;
    } else {
      itemsContainer.innerHTML = detailed.map(item => `
        <article class="cart-item">
          <a class="cart-item-image" href="product.html?id=${encodeURIComponent(item.id)}" aria-label="View ${escapeHtml(item.name)}">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy">
          </a>
          <div class="cart-item-main">
            <a class="cart-item-name" href="product.html?id=${encodeURIComponent(item.id)}">${escapeHtml(item.name)}</a>
            <div class="cart-item-meta">${formatBDT(item.price)} each</div>
            <div class="cart-item-bottom">
              <div class="quantity-control" aria-label="Quantity controls">
                <button type="button" data-cart-minus="${escapeHtml(item.id)}" aria-label="Decrease quantity">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-cart-plus="${escapeHtml(item.id)}" aria-label="Increase quantity">+</button>
              </div>
              <strong>${formatBDT(item.subtotal)}</strong>
            </div>
            <button type="button" class="text-button danger" data-cart-remove="${escapeHtml(item.id)}">Remove</button>
          </div>
        </article>`).join("");
    }
  }

  const drawerConfirm = document.getElementById("drawerConfirmBtn");
  if (drawerConfirm) drawerConfirm.disabled = quantity === 0;

  const confirmOrderBtn = document.getElementById("confirmOrderBtn");
  if (confirmOrderBtn) confirmOrderBtn.disabled = quantity === 0;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
