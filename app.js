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

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy || 0);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        setLocationStatus(
          "تعذر قراءة موقعك.",
          true
        );

        if (button) {
          button.disabled = false;
          button.textContent = "📍 تحديد موقعي على الخريطة";
        }

        return;
      }

      const mapUrl = makeMapUrl(lat, lng);

      customerLocation = {
        lat,
        lng,
        accuracy,
        mapUrl
      };

      setLocationStatus(
        `تم تحديد موقعك بنجاح 📍`
      );

      const map = $("customerMap");

      if (map) {
        map.href = mapUrl;
        map.classList.remove("hidden");
      }

      if (button) {
        button.disabled = false;
        button.textContent = "📍 تحديث موقعي";
      }
    },

    error => {
      let message = "تعذر تحديد موقعك.";

      if (error.code === 1) {
        message =
          "تم رفض إذن الموقع. اسمح للموقع من إعدادات المتصفح ثم حاول مرة أخرى.";
      } else if (error.code === 2) {
        message =
          "تعذر الحصول على الموقع حاليًا. تأكد من تشغيل GPS.";
      } else if (error.code === 3) {
        message =
          "انتهت مهلة تحديد الموقع. حاول مرة أخرى.";
      }

      setLocationStatus(message, true);

      if (button) {
        button.disabled = false;
        button.textContent = "📍 تحديد موقعي على الخريطة";
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

/* =========================
   إعدادات المحل
========================= */

async function loadStoreSettings() {
  try {
    const ref = doc(db, "settings", "store");
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) return;

    const data = snapshot.data() || {};

    storeWhatsapp = String(
      data.whatsapp || ""
    ).replace(/\D/g, "");

    storeLocation = String(
      data.location || ""
    ).trim();
  } catch (error) {
    console.error(
      "Error loading store settings:",
      error
    );
  }
}

function getInternationalWhatsapp(number) {
  let value = String(number || "")
    .replace(/\D/g, "");

  if (value.startsWith("00")) {
    value = value.slice(2);
  }

  if (value.startsWith("0")) {
    value = "20" + value.slice(1);
  }

  return value;
}

function updateWhatsappButton() {
  const wa = $("wa");

  if (!wa || !storeWhatsapp) return;

  const number = getInternationalWhatsapp(
    storeWhatsapp
  );

  if (!number) return;

  wa.href = `https://wa.me/${number}`;
  wa.classList.remove("hidden");
}

/* =========================
   إرسال الطلب
========================= */

function validatePhone(phone) {
  const clean = String(phone || "")
    .replace(/[\s\-()]/g, "");

  return /^[+]?\d{8,20}$/.test(clean);
}

async function sendOrder() {
  const name = String($("name")?.value || "").trim();
  const phone = String($("phone")?.value || "").trim();
  const address = String($("addr")?.value || "").trim();
  const status = $("status");

  const showError = message => {
    if (!status) return;

    status.textContent = message;
    status.classList.remove("hidden");
    status.style.color = "#b00020";
  };

  if (!name) {
    showError("من فضلك اكتب الاسم.");
    return;
  }

  if (!validatePhone(phone)) {
    showError("من فضلك اكتب رقم موبايل صحيح.");
    return;
  }

  if (!address) {
    showError("من فضلك اكتب العنوان بالتفصيل.");
    return;
  }

  if (!customerLocation) {
    showError(
      "من فضلك حدد موقعك على الخريطة أولًا."
    );
    return;
  }

  const items = getCartItems();

  if (!items.length) {
    showError("السلة فارغة.");
    return;
  }

  const total = items.reduce(
    (sum, item) => sum + item.total,
    0
  );

  const sendButton = $("send");

  if (sendButton) {
    sendButton.disabled = true;
    sendButton.textContent = "⏳ جاري إرسال الطلب...";
  }

  try {
    const orderData = {
      name,
      phone,
      address,
      items,
      total,
      status: "new",
      createdAt: serverTimestamp(),

      customerLocation: {
        lat: customerLocation.lat,
        lng: customerLocation.lng,
        accuracy: customerLocation.accuracy,
        mapUrl: customerLocation.mapUrl
      },

      lat: customerLocation.lat,
      lng: customerLocation.lng,
      mapUrl: customerLocation.mapUrl,

      store: {
        whatsapp: storeWhatsapp,
        location: storeLocation
      },

      storeWhatsapp,
      storeLocation
    };

    await addDoc(
      collection(db, "orders"),
      orderData
    );

    const waNumber =
      getInternationalWhatsapp(storeWhatsapp);

    if (!waNumber) {
      throw new Error(
        "رقم واتساب المحل غير مضبوط في إعدادات المتجر."
      );
    }

    let message =
      `🛒 *طلب جديد من دلوقتي ماركت*\n\n`;

    message += `👤 الاسم: ${name}\n`;
    message += `📱 الهاتف: ${phone}\n`;
    message += `📍 العنوان: ${address}\n\n`;

    message += `🧾 *المنتجات:*\n`;

    items.forEach(item => {
      message +=
        `• ${item.name} × ${item.qty} = ` +
        `${formatPrice(item.total)} ج\n`;
    });

    message +=
      `\n💰 *الإجمالي: ${formatPrice(total)} جنيه*\n`;

    message +=
      `\n📍 *موقع العميل:*\n` +
      `${customerLocation.mapUrl}\n`;

    if (storeLocation) {
      message +=
        `\n🏪 *موقع المحل:*\n` +
        `${storeLocation}\n`;
    }

    message +=
      `\n📞 واتساب المحل: ${storeWhatsapp}`;

    const whatsappUrl =
      `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

    cart = {};
    saveCart();
    updateCart();
    renderProducts();

    if (status) {
      status.textContent =
        "تم تسجيل الطلب بنجاح ✅ سيتم فتح واتساب لإرسال التفاصيل.";
      status.classList.remove("hidden");
      status.style.color = "#16803c";
    }

    window.location.href = whatsappUrl;

  } catch (error) {
    console.error("Order error:", error);

    showError(
      "حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى."
    );

    if (sendButton) {
      sendButton.disabled = false;
      sendButton.textContent = "تأكيد الطلب";
    }
  }
}

/* =========================
   مراقبة المنتجات
========================= */

function listenProducts() {
  const productsQuery = query(
    collection(db, "products"),
    orderBy("name")
  );

  onSnapshot(
    productsQuery,
    snapshot => {
      products = snapshot.docs
        .map(item =>
          normalizeProduct(
            item.id,
            item.data()
          )
        )
        .filter(product =>
          product.name &&
          Number.isFinite(product.price) &&
          product.price >= 0
        );

      /* تنظيف السلة من المنتجات المحذوفة
         أو الكميات التي أصبحت أكبر من المخزون */
      const validIds = new Set(
        products.map(p => p.id)
      );

      Object.keys(cart).forEach(id => {
        if (!validIds.has(id)) {
          delete cart[id];
          return;
        }

        const product = products.find(
          p => p.id === id
        );

        const qty = Number(cart[id] || 0);

        if (!product || product.stock <= 0) {
          delete cart[id];
        } else if (qty > product.stock) {
          cart[id] = product.stock;
        }
      });

      saveCart();

      renderCategories();
      renderProducts();
      updateCart();
    },

    error => {
      console.error(
        "Products listener error:",
        error
      );

      const empty = $("empty");

      if (empty) {
        empty.textContent =
          "تعذر تحميل المنتجات حاليًا.";
        empty.classList.remove("hidden");
      }
    }
  );
}

/* =========================
   البحث
========================= */

function setupSearch() {
  const search = $("q");

  if (!search) return;

  search.addEventListener(
    "input",
    renderProducts
  );
}

/* =========================
   تجهيز الواجهة
========================= */

function setupExtraUI() {
  const main = document.querySelector("main");

  if (!main) return;

  /* لو categories مش موجود في index */
  if (!$("categories")) {
    const categories = document.createElement("div");

    categories.id = "categories";
    categories.style.marginTop = "1rem";

    const search = $("q");

    if (search?.parentNode) {
      search.parentNode.insertBefore(
        categories,
        search.nextSibling
      );
    } else {
      main.prepend(categories);
    }
  }

  /* صندوق الموقع */
  if (!$("locationBox")) {
    const cartDetail = $("detail");

    if (cartDetail) {
      const box = document.createElement("div");

      box.id = "locationBox";
      box.className = "card";
      box.style.marginTop = "1rem";

      box.innerHTML = `
        <strong>📍 موقع التوصيل</strong>

        <p
          id="locationStatus"
          class="msg"
          style="margin:.5rem 0"
        >
          لم يتم تحديد موقعك بعد.
        </p>

        <button
          type="button"
          class="ghost"
          id="getLocation"
          style="width:100%"
        >
          📍 تحديد موقعي على الخريطة
        </button>

        <a
          id="customerMap"
          href="#"
          target="_blank"
          rel="noopener"
          class="hidden"
          style="
            display:block;
            margin-top:.5rem
          "
        >
          📍 فتح موقعي على Google Maps
        </a>
      `;

      cartDetail.insertBefore(
        box,
        cartDetail.querySelector("#status")
      );
    }
  }

  $("getLocation")?.addEventListener(
    "click",
    setCustomerLocation
  );

  $("send")?.addEventListener(
    "click",
    sendOrder
  );

  $("toggle")?.addEventListener(
    "click",
    () => {
      $("detail")?.classList.toggle("hidden");
    }
  );
}

/* =========================
   تشغيل التطبيق
========================= */

async function init() {
  setupExtraUI();
  setupSearch();

  await loadStoreSettings();
  updateWhatsappButton();

  listenProducts();

  updateCart();
}

init().catch(error => {
  console.error(
    "Application initialization error:",
    error
  );
});
