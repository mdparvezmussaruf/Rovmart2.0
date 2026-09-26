/* ROVMART UI and page behavior */
document.addEventListener("DOMContentLoaded", () => {
  cleanCart();
  renderCartUI();
  renderCategoryMenu();
  bindGlobalEvents();
  initSearch();
  initReveal();
  initCursor();

  const path = window.location.pathname.toLowerCase();
  if (path.endsWith("/product.html") || path.endsWith("product.html")) {
    renderProductDetail();
  } else {
    renderProductGrid(getRequestedCategory());
    setActiveCategory(getRequestedCategory());
  }

  registerServiceWorker();
});

function getRequestedCategory() {
  const category = new URLSearchParams(window.location.search).get("category");
  return getCategories().includes(category) ? category : "All products";
}

function getCategories() {
  const categories = [...new Set(
    products
      .filter(product => product.available)
      .map(product => String(product.category || "").trim())
      .filter(Boolean)
  )];
  return ["All products", ...categories];
}

function renderCategoryMenu() {
  const list = document.getElementById("categoryList");
  if (!list) return;
  list.innerHTML = getCategories().map((category, index) => `
    <button type="button" class="category-item" data-category="${escapeHtml(category)}">
      <span class="category-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="category-item-name">${escapeHtml(category)}</span>
      <span class="category-arrow">↗</span>
    </button>`).join("");
}

function setActiveCategory(category) {
  document.querySelectorAll("[data-category]").forEach(button => {
    button.classList.toggle("active", button.dataset.category === category);
  });
}

function renderProductGrid(category = "All products", searchTerm = "") {
  const grid = document.getElementById("productGrid");
  if (!grid) return;

  const term = String(searchTerm).trim().toLowerCase();
  const visible = products.filter(product => {
    if (!product.available) return false;
    const categoryMatch = category === "All products" || product.category === category;
    const searchMatch = !term || [product.name, product.category, product.description, ...(product.details || [])]
      .join(" ")
      .toLowerCase()
      .includes(term);
    return categoryMatch && searchMatch;
  });

  const count = document.getElementById("productCount");
  if (count) count.textContent = `${visible.length} piece${visible.length === 1 ? "" : "s"}`;

  if (!visible.length) {
    grid.innerHTML = `
      <div class="empty-results">
        <p class="eyebrow">NO MATCH</p>
        <h3>Nothing found.</h3>
        <p>Try another category or search term.</p>
        <button class="button button-dark" type="button" id="clearFiltersBtn">Show all products</button>
      </div>`;
    document.getElementById("clearFiltersBtn")?.addEventListener("click", () => {
      const search = document.getElementById("productSearch");
      if (search) search.value = "";
      renderProductGrid("All products", "");
      setActiveCategory("All products");
      updateSearchMeta();
    });
    return;
  }

  grid.innerHTML = visible.map((product, index) => {
    const discount = product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;
    return `
      <article class="product-card reveal" style="--delay:${Math.min(index, 5) * 55}ms">
        <div class="product-media zoom-image" data-zoom>
          <a href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHtml(product.name)}">
            <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
          </a>
          ${discount ? `<span class="sale-badge">-${discount}%</span>` : ""}
        </div>
        <div class="product-card-body">
          <p class="product-category">${escapeHtml(product.category)}</p>
          <h3 class="product-name"><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h3>
          <div class="product-price-row">
            <strong>${formatBDT(product.price)}</strong>
            ${product.oldPrice ? `<del>${formatBDT(product.oldPrice)}</del>` : ""}
          </div>
          <button type="button" class="button button-dark full" data-add="${escapeHtml(product.id)}">Add to cart</button>
        </div>
      </article>`;
  }).join("");

  setupZoomImages();
  initReveal();
}

function filterByCategory(category) {
  if (!getCategories().includes(category)) return;
  closeCategoryMenu();
  const search = document.getElementById("productSearch");
  if (search) search.value = "";
  updateSearchMeta();

  const path = window.location.pathname.toLowerCase();
  if (path.endsWith("/product.html") || path.endsWith("product.html")) {
    window.location.href = `index.html?category=${encodeURIComponent(category)}#shop`;
    return;
  }

  renderProductGrid(category, "");
  setActiveCategory(category);
  document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderProductDetail() {
  const container = document.getElementById("productDetail");
  if (!container) return;

  const id = new URLSearchParams(window.location.search).get("id");
  const product = products.find(item => item.id === id && item.available);

  if (!product) {
    document.title = "ROVMART — Product not found";
    container.innerHTML = `
      <div class="not-found">
        <p class="eyebrow">404 / PRODUCT</p>
        <h1>Piece not found.</h1>
        <p>The product may have been removed or is currently unavailable.</p>
        <a class="button button-dark" href="index.html#shop">Back to collection</a>
      </div>`;
    return;
  }

  document.title = `${product.name} — ROVMART`;
  const discount = product.oldPrice > product.price
    ? Math.round((1 - product.price / product.oldPrice) * 100)
    : 0;

  container.innerHTML = `
    <div class="detail-media zoom-image" data-zoom>
      <img id="detailImage" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
      <div class="zoom-hint">Move to zoom</div>
    </div>
    <div class="detail-copy">
      <p class="product-category">${escapeHtml(product.category)}</p>
      <h1>${escapeHtml(product.name)}</h1>
      <div class="detail-price-row">
        <strong>${formatBDT(product.price)}</strong>
        ${product.oldPrice ? `<del>${formatBDT(product.oldPrice)}</del>` : ""}
        ${discount ? `<span class="discount-pill">-${discount}%</span>` : ""}
      </div>
      <p class="detail-description">${escapeHtml(product.description)}</p>
      <div class="detail-block">
        <div class="detail-block-head"><span>Details</span><span>ROVMART / ${escapeHtml(product.id)}</span></div>
        <ul class="detail-list">${product.details.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div class="detail-actions">
        <div class="quantity-control large" aria-label="Select quantity">
          <button type="button" id="detailMinus" aria-label="Decrease quantity">−</button>
          <span id="detailQuantity">1</span>
          <button type="button" id="detailPlus" aria-label="Increase quantity">+</button>
        </div>
        <button type="button" class="button button-dark" id="detailAddBtn">Add to cart</button>
      </div>
      <p class="detail-note">Cash on delivery • Inside Dhaka ৳50 • Outside Dhaka ৳100</p>
    </div>
  `;

  let quantity = 1;
  const quantityNode = document.getElementById("detailQuantity");
  document.getElementById("detailMinus")?.addEventListener("click", () => {
    quantity = Math.max(1, quantity - 1);
    quantityNode.textContent = String(quantity);
  });
  document.getElementById("detailPlus")?.addEventListener("click", () => {
    quantity = Math.min(MAX_QUANTITY, quantity + 1);
    quantityNode.textContent = String(quantity);
  });
  document.getElementById("detailAddBtn")?.addEventListener("click", () => addToCart(product.id, quantity));

  setupZoomImages();
  initReveal();
}

function setupZoomImages() {
  document.querySelectorAll("[data-zoom]").forEach(wrapper => {
    if (wrapper.dataset.zoomReady === "true") return;
    const img = wrapper.querySelector("img");
    if (!img) return;

    const move = event => {
      if (!window.matchMedia("(pointer: fine)").matches) return;
      const rect = wrapper.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      img.style.transformOrigin = `${x * 100}% ${y * 100}%`;
      img.style.transform = "scale(1.62)";
      wrapper.classList.add("is-zoomed");
    };

    const reset = () => {
      img.style.transform = "";
      img.style.transformOrigin = "";
      wrapper.classList.remove("is-zoomed");
    };

    wrapper.addEventListener("pointermove", move);
    wrapper.addEventListener("pointerleave", reset);
    wrapper.dataset.zoomReady = "true";
  });
}

function bindGlobalEvents() {
  document.getElementById("menuToggle")?.addEventListener("click", toggleCategoryMenu);
  document.getElementById("closeMenuBtn")?.addEventListener("click", closeCategoryMenu);
  document.getElementById("categoryOverlay")?.addEventListener("click", closeCategoryMenu);

  document.getElementById("categoryList")?.addEventListener("click", event => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    filterByCategory(button.dataset.category);
  });

  document.addEventListener("click", event => {
    const add = event.target.closest("[data-add]");
    if (add) addToCart(add.dataset.add);

    const plus = event.target.closest("[data-cart-plus]");
    if (plus) {
      const item = getCart().find(entry => entry.id === plus.dataset.cartPlus);
      if (item) updateCartQuantity(item.id, item.quantity + 1);
    }

    const minus = event.target.closest("[data-cart-minus]");
    if (minus) {
      const item = getCart().find(entry => entry.id === minus.dataset.cartMinus);
      if (item) updateCartQuantity(item.id, item.quantity - 1);
    }

    const remove = event.target.closest("[data-cart-remove]");
    if (remove) removeFromCart(remove.dataset.cartRemove);
  });

  document.getElementById("cartLink")?.addEventListener("click", openCartDrawer);
  document.getElementById("closeCartBtn")?.addEventListener("click", closeCartDrawer);
  document.getElementById("cartDrawer")?.addEventListener("click", event => {
    if (event.target.id === "cartDrawer") closeCartDrawer();
  });
  document.getElementById("confirmOrderBtn")?.addEventListener("click", openOrderModal);
  document.getElementById("drawerConfirmBtn")?.addEventListener("click", () => {
    closeCartDrawer();
    openOrderModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeCategoryMenu();
      closeCartDrawer();
      closeOrderModal();
    }
  });
}

function toggleCategoryMenu() {
  const menu = document.getElementById("categoryMenu");
  const overlay = document.getElementById("categoryOverlay");
  if (!menu || !overlay) return;
  const open = !menu.classList.contains("open");
  menu.classList.toggle("open", open);
  overlay.classList.toggle("hidden", !open);
  menu.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("no-scroll", open);
  document.getElementById("menuToggle")?.setAttribute("aria-expanded", String(open));
}

function closeCategoryMenu() {
  const menu = document.getElementById("categoryMenu");
  const overlay = document.getElementById("categoryOverlay");
  if (!menu || !overlay) return;
  menu.classList.remove("open");
  overlay.classList.add("hidden");
  menu.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
  document.getElementById("menuToggle")?.setAttribute("aria-expanded", "false");
}

function openCartDrawer() {
  renderCartUI();
  const drawer = document.getElementById("cartDrawer");
  if (!drawer) return;
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}

function closeCartDrawer() {
  const drawer = document.getElementById("cartDrawer");
  if (!drawer) return;
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("no-scroll");
}

function showToast(message) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(window.toastTimer);
  window.toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function initSearch() {
  const input = document.getElementById("productSearch");
  if (!input) return;
  input.addEventListener("input", () => {
    const category = getRequestedCategory();
    renderProductGrid(category, input.value);
    setActiveCategory(category);
    updateSearchMeta();
  });

  document.getElementById("clearSearchBtn")?.addEventListener("click", () => {
    input.value = "";
    renderProductGrid(getRequestedCategory(), "");
    updateSearchMeta();
    input.focus();
  });
}

function updateSearchMeta() {
  const meta = document.getElementById("searchMeta");
  const input = document.getElementById("productSearch");
  const value = input?.value.trim() || "";
  if (meta) meta.textContent = value ? `Searching for “${value}”` : "Search the collection";
}

function initReveal() {
  const items = document.querySelectorAll(".reveal:not(.is-visible)");
  if (!items.length) return;
  if (!("IntersectionObserver" in window)) {
    items.forEach(item => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  items.forEach(item => observer.observe(item));
}

function initCursor() {
  const dot = document.getElementById("cursorDot");
  if (!dot || window.matchMedia("(pointer: coarse)").matches) return;
  document.addEventListener("pointermove", event => {
    dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  });
  document.addEventListener("pointerover", event => {
    dot.classList.toggle("cursor-active", Boolean(event.target.closest("a,button,.zoom-image")));
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
