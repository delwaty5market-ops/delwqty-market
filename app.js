import {
  db,
  esc,
  collection,
  addDoc,
  onSnapshot,
  doc,
  serverTimestamp
} from "./config.js";


const $ = selector => document.querySelector(selector);


/* =====================================================
   المتغيرات
===================================================== */

let products = [];
let cart = {};

let storeWhatsapp = "";
let storeLocation = "";

let selectedCategory = "all";

let customerLocation = null;


/* =====================================================
   الأقسام
===================================================== */

const CATEGORIES = {
  "بقالة": "🛒 بقالة",
  "مشروبات": "🥤 مشروبات",
  "ألبان": "🥛 ألبان",
  "مخبوزات": "🍞 مخبوزات",
  "منظفات": "🧴 منظفات",
  "عناية شخصية": "🧼 عناية شخصية",
  "مجمدات": "❄️ مجمدات",
  "حلويات": "🍫 حلويات",
  "فواكه وخضروات": "🥬 فواكه وخضروات",
  "معلبات": "🥫 معلبات",
  "أخرى": "📦 أخرى"
};


/* =====================================================
   تحميل السلة من الجهاز
===================================================== */

try {

  const saved =
    JSON.parse(
      localStorage.getItem("cart") || "{}"
    );


  if (
    saved &&
    typeof saved === "object" &&
    !Array.isArray(saved)
  ) {

    cart = saved;

  }

} catch {

  cart = {};

}


/* =====================================================
   أدوات مساعدة
===================================================== */

const saveCart = () => {

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );

};


const fmt = number => {

  const value =
    Number(number) || 0;

  return (
    value.toLocaleString("ar-EG") +
    " ج.م"
  );

};


const normalizeText = value => {

  return String(value || "")
    .trim()
    .toLocaleLowerCase("ar-EG");

};


const safeImageUrl = url => {

  if (!url) return "";

  try {

    const parsed =
      new URL(
        String(url),
        window.location.href
      );


    if (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:"
    ) {

      return parsed.href;

    }


    return "";

  } catch {

    return "";

  }

};


const getProduct = id => {

  return products.find(
    product => product.id === id
  );

};


/* =====================================================
   إنشاء واجهة الأقسام والموقع
===================================================== */

function setupExtraUI() {

  /*
   * إذا لم يكن هناك عنصر للأقسام في index.html
   * ننشئه تلقائيًا.
   */

  if (!$("#categories") && $("#list")) {

    const categories = document.createElement("div");

    categories.id = "categories";

    categories.className = "tabs";

    categories.style.marginBottom = "1rem";

    $("#list").parentNode.insertBefore(
      categories,
      $("#list")
    );

  }


  /*
   * واجهة تحديد الموقع
   */

  if (
    !$("#locationBox") &&
    $("#send")
  ) {

    const box =
      document.createElement("div");

    box.id = "locationBox";

    box.className = "card";

    box.style.marginTop = "1rem";


    box.innerHTML = `
      <strong>
        📍 موقع التوصيل
      </strong>

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
        style="display:block;margin-top:.5rem"
      >
        فتح موقعي على Google Maps
      </a>
    `;


    $("#send").parentNode.insertBefore(
      box,
      $("#send")
    );

  }

}


/* تشغيل الواجهة الإضافية */

setupExtraUI();


/* =====================================================
   Firebase - المنتجات
===================================================== */

onSnapshot(
  collection(db, "products"),

  snapshot => {

    products = snapshot.docs

      .map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }))

      .filter(
        product =>
          product.active !== false
      );


    /*
     * تنظيف السلة من المنتجات
     * التي لم تعد موجودة أو متاحة
     */

    let changed = false;


    for (
      const id of Object.keys(cart)
    ) {

      const product =
        getProduct(id);


      if (!product) {

        delete cart[id];

        changed = true;

        continue;
      }


      const stock =
        Math.max(
          0,
          Number(product.stock) || 0
        );


      if (stock <= 0) {

        delete cart[id];

        changed = true;

        continue;
      }


      const currentQty =
        Math.max(
          0,
          Number(cart[id]) || 0
        );


      if (currentQty > stock) {

        cart[id] = stock;

        changed = true;

      }


      if (currentQty <= 0) {

        delete cart[id];

        changed = true;

      }

    }


    if (changed) {

      saveCart();

    }


    renderCategories();

    renderList();

    renderCart();

  },

  error => {

    console.error(
      "Products listener error:",
      error
    );


    if ($("#empty")) {

      $("#empty").classList.remove(
        "hidden"
      );

      $("#empty").textContent =
        "تعذر تحميل المنتجات حاليًا. حاول تحديث الصفحة.";

    }

  }
);


/* =====================================================
   Firebase - إعدادات المتجر
===================================================== */

onSnapshot(
  doc(db, "settings", "store"),

  snapshot => {

    if (!snapshot.exists()) {

      storeWhatsapp = "";

      storeLocation = "";

      if ($("#wa")) {

        $("#wa").classList.add(
          "hidden"
        );

      }

      return;

    }


    const data =
      snapshot.data() || {};


    /*
     * رقم واتساب المحل
     */

    const whatsapp =
      String(
        data.whatsapp || ""
      ).replace(/\D/g, "");


    storeWhatsapp =
      whatsapp;


    /*
     * رابط موقع المحل
     */

    storeLocation =
      String(
        data.location || ""
      ).trim();


    if (
      whatsapp &&
      $("#wa")
    ) {

      $("#wa").href =
        "https://wa.me/" +
        whatsapp;

      $("#wa").classList.remove(
        "hidden"
      );

    } else if ($("#wa")) {

      $("#wa").classList.add(
        "hidden"
      );

    }

  },

  error => {

    console.error(
      "Store settings error:",
      error
    );

  }
);


/* =====================================================
   عرض الأقسام
===================================================== */

function renderCategories() {

  const container =
    $("#categories");


  if (!container) return;


  /*
   * معرفة الأقسام الموجودة فعليًا
   */

  const usedCategories =
    new Set(
      products.map(
        product =>
          product.category || "أخرى"
      )
    );


  const buttons = [];


  buttons.push(`
    <button
      type="button"
      class="${selectedCategory === "all" ? "on" : ""}"
      data-category="all"
    >
      🛍️ الكل
    </button>
  `);


  Object.entries(CATEGORIES)
    .forEach(
      ([key, label]) => {

        if (
          !usedCategories.has(key)
        ) {
          return;
        }


        buttons.push(`
          <button
            type="button"
            class="${selectedCategory === key ? "on" : ""}"
            data-category="${esc(key)}"
          >
            ${esc(label)}
          </button>
        `);

      }
    );


  container.innerHTML =
    buttons.join("");


  /*
   * الضغط على القسم
   */

  container.onclick = event => {

    const button =
      event.target.closest(
        "[data-category]"
      );


    if (!button) return;


    selectedCategory =
      button.dataset.category;


    renderCategories();

    renderList();

  };

}


/* =====================================================
   عرض المنتجات
===================================================== */

function renderList() {

  const searchInput =
    $("#q");


  const query =
    searchInput
      ? normalizeText(
          searchInput.value
        )
      : "";


  const items =
    products.filter(product => {

      const name =
        normalizeText(
          product.name
        );


      const category =
        product.category ||
        "أخرى";


      const matchesSearch =
        !query ||
        name.includes(query);


      const matchesCategory =
        selectedCategory === "all" ||
        category === selectedCategory;


      return (
        matchesSearch &&
        matchesCategory
      );

    });


  if ($("#empty")) {

    $("#empty").classList.toggle(
      "hidden",
      items.length > 0
    );

  }


  if (!items.length) {

    if ($("#list")) {

      $("#list").innerHTML = "";

    }

    return;

  }


  $("#list").innerHTML =
    items.map(product => {

      const stock =
        Math.max(
          0,
          Number(product.stock) || 0
        );


      const price =
        Math.max(
          0,
          Number(product.price) || 0
        );


      const out =
        stock <= 0;


      const image =
        safeImageUrl(
          product.image
        );


      const category =
        product.category ||
        "أخرى";


      const categoryName =
        CATEGORIES[category] ||
        category;


      return `
        <div class="card">

          ${
            image
              ? `
                <img
                  src="${esc(image)}"
                  alt="${esc(
                    product.name ||
                    "منتج"
                  )}"
                  loading="lazy"
                  onerror="
                    this.style.display='none'
                  "
                >
              `
              : `
                <div class="product-placeholder">
                  لا توجد صورة
                </div>
              `
          }


          <small>
            ${esc(categoryName)}
          </small>


          <div class="product-name">
            ${esc(
              product.name ||
              "منتج بدون اسم"
            )}
          </div>


          <div class="price">
            ${fmt(price)}
          </div>


          ${
            stock > 0
              ? `
                <small
