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

/* =========================
   الأقسام
========================= */

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


/* =========================
   الحالة
========================= */

let products = [];

let selectedCategory = "all";

let storeWhatsapp = "";
let storeLocation = "";

let customerLocation = null;


/* =========================
   عناصر الصفحة
========================= */

const list = document.getElementById("list");
const empty = document.getElementById("empty");
const categoriesBox = document.getElementById("categories");

const searchInput = document.getElementById("q");
const clearSearch = document.getElementById("clearSearch");

const cartBox = document.getElementById("cart");
const cartSum = document.getElementById("sum");
const cartLines = document.getElementById("lines");

const cartToggle = document.getElementById("toggle");

const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const addressInput = document.getElementById("addr");

const locationStatus = document.getElementById("locationStatus");
const getLocationBtn = document.getElementById("getLocation");
const customerMap = document.getElementById("customerMap");

const orderStatus = document.getElementById("status");
const sendButton = document.getElementById("send");

const whatsappLink = document.getElementById("wa");


/* =========================
   السلة
========================= */

function getCart() {

  try {

    const cart = JSON.parse(
      localStorage.getItem("cart") || "{}"
    );

    if (!cart || typeof cart !== "object") {
      return {};
    }

    return cart;

  } catch (error) {

    console.error("Cart loading error:", error);

    return {};
  }
}


function saveCart(cart) {

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );
}


/* =========================
   الأسعار
========================= */

function formatPrice(value) {

  const number = Number(value || 0);

  return number.toLocaleString("ar-EG", {
    maximumFractionDigits: 2
  });
}


/* =========================
   الأقسام
========================= */

function getCategory(product) {

  const category = product?.category;

  if (!category) {
    return "أخرى";
  }

  const exists = CATEGORIES.some(
    item => item.id === category
  );

  return exists ? category : "أخرى";
}


function getCategoryInfo(category) {

  return (
    CATEGORIES.find(
      item => item.id === category
    ) ||
    CATEGORIES[CATEGORIES.length - 1]
  );
}


function renderCategories() {

  if (!categoriesBox) {
    return;
  }

  categoriesBox.innerHTML = CATEGORIES
    .map(category => {

      const active =
        selectedCategory === category.id
          ? "on"
          : "";

      return `
        <button
          type="button"
          class="category-btn ${active}"
          data-category="${esc(category.id)}"
        >
          ${category.icon}
          ${esc(category.name)}
        </button>
      `;

    })
    .join("");

  categoriesBox
    .querySelectorAll("[data-category]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectedCategory =
            button.dataset.category || "all";

          renderCategories();
          renderProducts();

          window.scrollTo({
            top: 0,
            behavior: "smooth"
          });

        }
      );

    });
}


/* =========================
   توحيد المنتج
========================= */

function normalizeProduct(docSnap) {

  const data = docSnap.data() || {};

  return {
    id: docSnap.id,

    name: String(data.name || "منتج"),

    price: Number(data.price || 0),

    stock: Number(data.stock || 0),

    image: String(data.image || ""),

    category: getCategory(data),

    description: String(
      data.description || ""
    ),

    active: data.active !== false
  };
}


/* =========================
   تنظيف السلة
========================= */

function cleanCart() {

  const cart = getCart();

  let changed = false;

  Object.keys(cart).forEach(id => {

    const product = products.find(
      item => item.id === id
    );

    if (!product || !product.active) {

      delete cart[id];

      changed = true;

      return;
    }

    let qty = Number(
      cart[id]?.qty || 0
    );

    const stock = Number(
      product.stock || 0
    );

    if (stock <= 0) {

      delete cart[id];

      changed = true;

      return;
    }

    qty = Math.max(
      1,
      Math.min(qty, stock)
    );

    if (qty !== cart[id].qty) {

      cart[id].qty = qty;

      changed = true;
    }

    cart[id].name = product.name;
    cart[id].price = product.price;
    cart[id].image = product.image;
    cart[id].category = product.category;

  });

  if (changed) {
    saveCart(cart);
  }

  return cart;
}


/* =========================
   إضافة منتج للسلة
========================= */

function addToCart(productId, quantity = 1) {

  const product = products.find(
    item => item.id === productId
  );

  if (!product) {
    return;
  }

  if (!product.active) {
    return;
  }

  const stock = Number(
    product.stock || 0
  );

  if (stock <= 0) {

    showStatus(
      "المنتج غير متوفر حالياً.",
      true
    );

    return;
  }

  const cart = getCart();

  const currentQty = Number(
    cart[productId]?.qty || 0
  );

  const wantedQty =
    currentQty + Number(quantity || 1);

  const newQty = Math.min(
    wantedQty,
    stock
  );

  cart[productId] = {
    id: product.id,
    name: product.name,
    price: product.price,
    image: product.image,
    category: product.category,
    qty: newQty
  };

  saveCart(cart);

  renderCart();

  showStatus(
    "تمت إضافة المنتج إلى السلة ✓"
  );
}


/* =========================
   تغيير كمية
========================= */

function changeQuantity(productId, change) {

  const cart = getCart();

  if (!cart[productId]) {
    return;
  }

  const product = products.find(
    item => item.id === productId
  );

  if (!product) {

    delete cart[productId];

    saveCart(cart);

    renderCart();

    return;
  }

  const stock = Number(
    product.stock || 0
  );

  let qty =
    Number(cart[productId].qty || 0) +
    Number(change || 0);

  if (qty <= 0) {

    delete cart[productId];

  } else {

    qty = Math.min(
      qty,
      stock
    );

    cart[productId].qty = qty;
  }

  saveCart(cart);

  renderCart();
}


/* =========================
   حذف منتج
========================= */

function removeFromCart(productId) {

  const cart = getCart();

  delete cart[productId];

  saveCart(cart);

  renderCart();
}


/* =========================
   رسم المنتجات
========================= */

function renderProducts() {

  if (!list) {
    return;
  }

  const search =
    String(searchInput?.value || "")
      .trim()
      .toLowerCase();

  const filtered = products.filter(product => {

    if (!product.active) {
      return false;
    }

    if (
      selectedCategory !== "all" &&
      getCategory(product) !== selectedCategory
    ) {
      return false;
    }

    if (!search) {
      return true;
    }

    const name =
      product.name.toLowerCase();

    const category =
      getCategory(product).toLowerCase();

    return (
      name.includes(search) ||
      category.includes(search)
    );
  });

  if (!filtered.length) {

    list.innerHTML = "";

    if (empty) {
      empty.classList.remove("hidden");
    }

    return;
  }

  if (empty) {
    empty.classList.add("hidden");
  }

  list.innerHTML = filtered
    .map(product => {

      const category =
        getCategoryInfo(
          getCategory(product)
        );

      const image = product.image
        ? `
          <img
            src="${esc(product.image)}"
            alt="${esc(product.name)}"
            loading="lazy"
          >
        `
        : `
          <span
