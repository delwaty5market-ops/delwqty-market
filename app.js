import {
  db,
  esc,
  collection,
  doc,
  getDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "./config.js";

const CATEGORIES = [
  { id: "all", name: "الكل", icon: "🛍️" },
  { id: "بقالة", name: "بقالة", icon: "🛒" },
  { id: "مشروبات", name: "مشروبات", icon: "🥤" },
  { id: "ألبان", name: "ألبان", icon: "🥛" },
  { id: "مخبوزات", name: "مخبوزات", icon: "🍞" },
  { id: "منظفات", name: "منظفات", icon: "🧴" },
  { id: "عناية شخصية", name: "عناية شخصية", icon: "🧼" },
  { id: "مجمدات", name: "مجمدات", icon: "❄️" },
  { id: "حلويات", name: "حلويات", icon: "🍫" },
  { id: "فواكه وخضروات", name: "فواكه وخضروات", icon: "🥬" },
  { id: "معلبات", name: "معلبات", icon: "🥫" },
  { id: "أخرى", name: "أخرى", icon: "📦" }
];

let products = [];
let cart = JSON.parse(localStorage.getItem("cart") || "{}");
let selectedCategory = "all";

let storeWhatsapp = "";
let storeLocation = "";

let customerLocation = null;

const $ = id => document.getElementById(id);

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("ar-EG");
}

function getCategory(product) {
  const category = String(product?.category || "").trim();

  if (category && CATEGORIES.some(c => c.id === category)) {
    return category;
  }

  return "أخرى";
}

function getCategoryInfo(category) {
  return CATEGORIES.find(c => c.id === category) || CATEGORIES[CATEGORIES.length - 1];
}

function normalizeProduct(id, data) {
  const p = data || {};

  return {
    id,
    name: String(p.name ?? "").trim(),
    price: Number(p.price ?? 0),
    stock: Math.max(0, Number(p.stock ?? 0)),
    image: String(p.image ?? "").trim(),
    active: p.active !== false,
    category: getCategory(p)
  };
}

/* =========================
   الأقسام
========================= */

function renderCategories() {
  const box = $("categories");
  if (!box) return;

  const available = new Set(
    products.map(p => p.category)
  );

  box.innerHTML = CATEGORIES
    .filter(c => c.id === "all" || available.has(c.id))
    .map(c => `
      <button
        type="button"
        class="ghost category-btn ${selectedCategory === c.id ? "active" : ""}"
        data-category="${esc(c.id)}"
        style="margin:.25rem"
      >
        ${c.icon} ${esc(c.name)}
      </button>
    `)
    .join("");

  box.querySelectorAll("[data-category]").forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category || "all";
      renderCategories();
      renderProducts();
    });
  });
}

/* =========================
   المنتجات
========================= */

function renderProducts() {
  const list = $("list");
  const empty = $("empty");

  if (!list) return;

  const search = String($("q")?.value || "")
    .trim()
    .toLowerCase();

  const filtered = products.filter(p => {
    if (!p.active) return false;

    if (selectedCategory !== "all" &&
        p.category !== selectedCategory) {
      return false;
    }

    if (search) {
      const text = `${p.name} ${p.category}`.toLowerCase();

      if (!text.includes(search)) {
        return false;
      }
    }

    return true;
  });

  list.innerHTML = "";

  if (!filtered.length) {
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");

  filtered.forEach(product => {
    const category = getCategoryInfo(product.category);
    const inCart = Number(cart[product.id] || 0);
    const stock = Number(product.stock || 0);

    const card = document.createElement("article");
    card.className = "card";

    const imageHtml = product.image
      ? `
        <img
          src="${esc(product.image)}"
          alt="${esc(product.name)}"
          loading="lazy"
          style="
            width:100%;
            height:180px;
            object-fit:contain;
            border-radius:12px;
            background:#f7f7f7;
          "
          onerror="this.style.display='none'"
        >
      `
      : `
        <div style="
          height:180px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#f7f7f7;
          border-radius:12px;
          font-size:4rem;
        ">
          🛒
        </div>
      `;

    card.innerHTML = `
      ${imageHtml}

      <div style="margin-top:.7rem">
        <small style="opacity:.7">
          ${category.icon} ${esc(category.name)}
        </small>

        <h3 style="margin:.35rem 0">
          ${esc(product.name || "منتج")}
        </h3>

        <strong>
          ${formatPrice(product.price)} جنيه
        </strong>

        <div style="margin-top:.35rem;font-size:.9rem;opacity:.7">
          المتاح: ${formatPrice(stock)}
        </div>
      </div>

      <div
        class="row"
        style="margin-top:.8rem;gap:.5rem;align-items:center"
      >
        <button
          type="button"
          class="ghost minus"
          ${inCart <= 0 ? "disabled" : ""}
        >−</button>

        <strong class="qty">${inCart}</strong>

        <button
          type="button"
          class="sun plus"
          ${stock <= inCart ? "disabled" : ""}
        >+</button>
      </div>
    `;

    const minus = card.querySelector(".minus");
    const plus = card.querySelector(".plus");
    const qty = card.querySelector(".qty");

    minus?.addEventListener("click", () => {
      const current = Number(cart[product.id] || 0);

      if (current <= 1) {
        delete cart[product.id];
      } else {
        cart[product.id] = current - 1;
      }

      saveCart();
      updateCart();
      renderProducts();
    });

    plus?.addEventListener("click", () => {
      const current = Number(cart[product.id] || 0);

      if (current >= stock) return;

      cart[product.id] = current + 1;

      saveCart();
      updateCart();
      renderProducts();
    });

    list.appendChild(card);
  });
}

/* =========================
   السلة
========================= */

function getCartItems() {
  return Object.entries(cart)
    .map(([id, qty]) => {
      const product = products.find(p => p.id === id);

      if (!product) return null;

      const quantity = Math.min(
        Math.max(0, Number(qty || 0)),
        Number(product.stock || 0)
      );

      if (!quantity) return null;

      return {
        id: product.id,
        name: product.name,
        price: product.price,
        qty: quantity,
        total: product.price * quantity
      };
    })
    .filter(Boolean);
}

function updateCart() {
  const items = getCartItems();

  let total = 0;
  let count = 0;

  items.forEach(item => {
    total += item.total;
    count += item.qty;
  });

  const cartBox = $("cart");
  const sum = $("sum");

  if (cartBox) {
    cartBox.classList.toggle("hidden", count === 0);
  }

  if (sum) {
    sum.textContent =
      `${count} منتج — ${formatPrice(total)} جنيه`;
  }

  const lines = $("lines");

  if (lines) {
    lines.innerHTML = items.map(item => `
      <div
        class="row"
        style="
          justify-content:space-between;
          gap:.5rem;
          margin-bottom:.6rem;
          padding:.6rem;
          border-bottom:1px solid #eee;
        "
      >
        <span>
          ${esc(item.name)}
          × ${item.qty}
        </span>

        <strong>
          ${formatPrice(item.total)} ج
        </strong>
      </div>
    `).join("");
  }
}

/* =========================
   GPS
========================= */

function makeMapUrl(lat, lng) {
  return `https://www.google.com/maps?q=${encodeURIComponent(lat)},${encodeURIComponent(lng)}`;
}

function setLocationStatus(message, isError = false) {
  const status = $("locationStatus");

  if (!status) return;

  status.textContent = message;
  status.classList.remove("hidden");

  if (isError) {
    status.style.color = "#b00020";
  } else {
    status.style.color = "";
  }
}

function setCustomerLocation() {
  if (!navigator.geolocation) {
    setLocationStatus(
      "المتصفح لا يدعم تحديد الموقع.",
      true
    );
    return;
  }

  setLocationStatus("جاري تحديد موقعك...");

  const button = $("getLocation");

  if (button) {
    button.disabled = true;
    button.textContent = "⏳ جاري تحديد الموقع...";
  }

  navigator.geolocation.getCurrentPosition
