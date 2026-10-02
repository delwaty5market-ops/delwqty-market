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


let products = [];

let cart =
  JSON.parse(
    localStorage.getItem("cart") || "{}"
  );

let selectedCategory = "all";

let storeWhatsapp = "";

let storeLocation = "";

let customerLocation = null;


/* =========================
   أدوات
========================= */

const $ = id =>
  document.getElementById(id);


function saveCart() {

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );

}


function formatPrice(value) {

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return number.toLocaleString("ar-EG");
}


function getCategory(product) {

  const category =
    String(
      product?.category || ""
    ).trim();


  if (
    category &&
    CATEGORIES.some(
      item => item.id === category
    )
  ) {
    return category;
  }


  return "أخرى";
}


function getCategoryInfo(category) {

  return (
    CATEGORIES.find(
      item => item.id === category
    ) ||
    CATEGORIES[
      CATEGORIES.length - 1
    ]
  );
}


function normalizeProduct(id, data) {

  const p = data || {};


  return {

    id,

    name:
      String(
        p.name ?? ""
      ).trim(),

    price:
      Number(
        p.price ?? 0
      ),

    stock:
      Math.max(
        0,
        Number(
          p.stock ?? 0
        )
      ),

    image:
      String(
        p.image ?? ""
      ).trim(),

    active:
      p.active !== false,

    category:
      getCategory(p)

  };
}


/* =========================
   الأقسام
========================= */

function renderCategories() {

  const box =
    $("categories");

  if (!box) return;


  const available =
    new Set(
      products.map(
        product =>
          product.category
      )
    );


  box.innerHTML =
    CATEGORIES
      .filter(category => {

        return (
          category.id === "all" ||
          available.has(
            category.id
          )
        );

      })
      .map(category => {

        const active =
          selectedCategory ===
          category.id;


        return `
          <button
            type="button"
            class="category-btn ${
              active ? "active" : ""
            }"
            data-category="${esc(category.id)}"
          >
            <span>
              ${category.icon}
            </span>

            ${esc(category.name)}
          </button>
        `;

      })
      .join("");


  box
    .querySelectorAll(
      "[data-category]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectedCategory =
            button.dataset.category ||
            "all";

          renderCategories();

          renderProducts();

        }
      );

    });

}


/* =========================
   المنتجات
========================= */

function renderProducts() {

  const list =
    $("list");

  const empty =
    $("empty");

  if (!list) return;


  const search =
    String(
      $("q")?.value || ""
    )
      .trim()
      .toLowerCase();


  const filtered =
    products.filter(product => {

      if (!product.active) {
        return false;
      }


      if (
        selectedCategory !== "all" &&
        product.category !==
          selectedCategory
      ) {
        return false;
      }


      if (search) {

        const text =
          `${product.name} ${product.category}`
            .toLowerCase();


        if (
          !text.includes(search)
        ) {
          return false;
        }

      }


      return true;

    });


  list.innerHTML = "";


  const count =
    $("productsCount");


  if (count) {

    count.textContent =
      `${filtered.length} منتج`;

  }


  if (!filtered.length) {

    if (empty) {

      empty.textContent =
        search
          ? "لا توجد منتجات بهذا الاسم."
          : "لا توجد منتجات في هذا القسم حاليًا.";

      empty.classList.remove(
        "hidden"
      );

    }

    return;
  }


  if (empty) {

    empty.classList.add(
      "hidden"
    );

  }


  filtered.forEach(product => {

    const category =
      getCategoryInfo(
        product.category
      );


    const inCart =
      Number(
        cart[product.id] || 0
      );


    const stock =
      Number(
        product.stock || 0
      );


    const card =
      document.createElement(
        "article"
      );


    card.className =
      "product-card";


    /* =========================
       صورة
    ========================= */

    const imageHtml =
      product.image

        ? `
          <img
            src="${esc(product.image)}"
            alt="${esc(product.name)}"
            loading="lazy"
            onerror="
              this.parentElement.innerHTML =
              '<div class=&quot;product-placeholder&quot;>🛒</div>'
            "
          >
        `

        : `
          <div
            class="product-placeholder"
          >
            🛒
          </div>
        `;


    card.innerHTML = `

      <div class="product-image">
        ${imageHtml}
      </div>


      <div class="product-body">

        <div class="product-category">
          ${category.icon}
          ${esc(category.name)}
        </div>


        <h3 class="product-name">
          ${esc(
            product.name ||
            "منتج"
          )}
        </h3>


        <div class="product-price">

          ${formatPrice(
            product.price
          )}

          <small>
            جنيه
          </small>

        </div>


        <div class="product-actions">

          <button
            type="button"
            class="qty-btn minus"
            ${
              inCart <= 0
                ? "disabled"
                : ""
            }
            aria-label="تقليل الكمية"
          >
            −
          </button>


          <strong class="qty-number">
            ${inCart}
          </strong>


          <button
            type="button"
            class="qty-btn plus"
            ${
              stock <= inCart
                ? "disabled"
                : ""
            }
            aria-label="زيادة الكمية"
          >
            +
          </button>


          <button
            type="button"
            class="add-btn"
            ${
              stock <= inCart
                ? "disabled"
                : ""
            }
          >
            ${
              inCart > 0
                ? "إضافة"
                : "أضف للسلة"
            }
          </button>

        </div>

      </div>
    `;


    /* =========================
       تقليل
    ========================= */

    const minus =
      card.querySelector(
        ".minus"
      );


    minus?.addEventListener(
      "click",
      () => {

        const current =
          Number(
            cart[product.id] || 0
          );


        if (current <= 1) {

          delete cart[
            product.id
          ];

        } else {

          cart[
            product.id
          ] =
            current - 1;

        }


        saveCart();

        updateCart();

        renderProducts();

      }
    );


    /* =========================
       زيادة
    ========================= */

    const plus =
      card.querySelector(
        ".plus"
      );


    plus?.addEventListener(
      "click",
      () => {

        const current =
          Number(
            cart[product.id] || 0
          );


        if (
          current >= stock
        ) {
          return;
        }


        cart[
          product.id
        ] =
          current + 1;


        saveCart();

        updateCart();

        renderProducts();

      }
    );


    /* =========================
       أضف للسلة
    ========================= */

    const add =
      card.querySelector(
        ".add-btn"
      );


    add?.addEventListener(
      "click",
      () => {

        const current =
          Number(
            cart[product.id] || 0
          );


        if (
          current >= stock
        ) {
          return;
        }


        cart[
          product.id
        ] =
          current + 1;


        saveCart();

        updateCart();

        renderProducts();

      }
    );


    list.appendChild(card);

  });

}


/* =========================
   بيانات السلة
========================= */

function getCartItems() {

  return Object.entries(cart)

    .map(([id, qty]) => {

      const product =
        products.find(
          p => p.id === id
        );


      if (!product) {
        return null;
      }


      const quantity =
        Math.min(
          Math.max(
            0,
            Number(qty || 0)
          ),
          Number(
            product.stock || 0
          )
        );


      if (!quantity) {
        return null;
      }


      return {

        id:
          product.id,

        name:
          product.name,

        price:
          product.price,

        qty:
          quantity,

        total:
          product.price *
          quantity

      };

    })

    .filter(Boolean);

}


/* =========================
   تحديث السلة
========================= */

function updateCart() {

  const items =
    getCartItems();


  let total = 0;

  let count = 0;


  items.forEach(item => {

    total +=
      item.total;

    count +=
      item.qty;

  });


  const cartBox =
    $("cart");


  const sum =
    $("sum");


  if (cartBox) {

    cartBox.classList.toggle(
      "hidden",
      count === 0
    );

  }


  if (sum) {

    sum.textContent =
      `${count} منتج — ${formatPrice(total)} جنيه`;

  }


  const lines =
    $("lines");


  if (!lines) return;


  lines.innerHTML =
    items
      .map(item => `

        <div
          class="cart-line"
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
            padding:10px 0;
            border-bottom:1px solid #e8ebf0;
          "
        >

          <div>

            <strong>
              ${esc(item.name)}
            </strong>

            <small
              style="
                display:block;
                color:#7b8495;
                margin-top:3px;
              "
            >
              ${item.qty} ×
              ${formatPrice(item.price)}
              جنيه
            </small>

          </div>


          <strong>
            ${formatPrice(item.total)}
            ج
          </strong>

        </div>

      `)
      .join("");

}


/* =========================
   Google Maps
========================= */

function makeMapUrl(
  lat,
  lng
) {

  return (
    "https://www.google.com/maps?q=" +
    encodeURIComponent(
      `${lat},${lng}`
    )
  );

}


function setLocationStatus(
  message,
  isError = false
) {

  const status =
    $("locationStatus");


  if (!status) return;


  status.textContent =
    message;


  status.classList.remove(
    "hidden"
  );


  status.style.color =
    isError
      ? "#b00020"
      : "";

}


function setCustomerLocation() {

  if (!navigator.geolocation) {

    setLocationStatus(
      "المتصفح لا يدعم تحديد الموقع.",
      true
    );

    return;
  }


  setLocationStatus(
    "جاري تحديد موقعك..."
  );


  const button =
    $("getLocation");


  if (button) {

    button.disabled =
      true;

    button.textContent =
      "⏳ جاري تحديد الموقع...";

  }


  navigator.geolocation.getCurrentPosition(

    position => {

      const lat =
        Number(
          position.coords.latitude
        );


      const lng =
        Number(
          position.coords.longitude
        );


      const accuracy =
        Number(
          position.coords.accuracy || 0
        );


      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {

        setLocationStatus(
          "تعذر قراءة موقعك.",
          true
        );


        if (button) {

          button.disabled =
            false;

          button.textContent =
            "📍 تحديد موقعي على الخريطة";

        }

        return;
      }


      const mapUrl =
        makeMapUrl(
          lat,
          lng
        );


      customerLocation = {

        lat,

        lng,

        accuracy,

        mapUrl

      };


      setLocationStatus(
        "تم تحديد موقعك بنجاح 📍"
      );


      const map =
        $("customerMap");


      if (map) {

        map.href =
          mapUrl;

        map.classList.remove(
          "hidden"
        );

      }


      if (button) {

        button.disabled =
          false;

        button.textContent =
          "📍 تحديث موقعي";

      }

    },


    error => {

      let message =
        "تعذر تحديد موقعك.";


      if (
        error.code === 1
      ) {

        message =
          "تم رفض إذن الموقع. اسمح للموقع من إعدادات المتصفح ثم حاول مرة أخرى.";

      } else if (
        error.code === 2
      ) {

        message =
          "تعذر الحصول على الموقع حاليًا. تأكد من تشغيل GPS.";

      } else if (
        error.code === 3
      ) {

        message =
          "انتهت مهلة تحديد الموقع. حاول مرة أخرى.";

      }


      setLocationStatus(
        message,
        true
      );


      if (button) {

        button.disabled =
          false;

        button.textContent =
          "📍 تحديد موقعي على الخريطة";

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

    const ref =
      doc(
        db,
        "settings",
        "store"
      );


    const snapshot =
      await getDoc(ref);


    if (
      !snapshot.exists()
    ) {
      return;
    }


    const data =
      snapshot.data() || {};


    storeWhatsapp =
      String(
        data.whatsapp || ""
      )
        .replace(
          /\D/g,
          ""
        );


    storeLocation =
      String(
        data.location || ""
      ).trim();

  } catch (error) {

    console.error(
      "Error loading store settings:",
      error
    );

  }

}


function getInternationalWhatsapp(
  number
) {

  let value =
    String(
      number || ""
    )
      .replace(
        /\D/g,
        ""
      );


  if (
    value.startsWith("00")
  ) {

    value =
      value.slice(2);

  }


  if (
    value.startsWith("0")
  ) {

    value =
      "20" +
      value.slice(1);

  }


  return value;

}


function updateWhatsappButton() {

  const wa =
    $("wa");


  if (
    !wa ||
    !storeWhatsapp
  ) {
    return;
  }


  const number =
    getInternationalWhatsapp(
      storeWhatsapp
    );


  if (!number) {
    return;
  }


  wa.href =
    `https://wa.me/${number}`;


  wa.classList.remove(
    "hidden"
  );

}


/* =========================
   الهاتف
========================= */

function validatePhone(
  phone
) {

  const clean =
    String(
      phone || ""
    )
      .replace(
        /[\s\-()]/g,
        ""
      );


  return /^[+]?\d{8,20}$/
    .test(clean);

}


/* =========================
   إرسال الطلب
========================= */

async function sendOrder() {

  const name =
    String(
      $("name")?.value ||
      ""
    ).trim();


  const phone =
    String(
      $("phone")?.value ||
      ""
    ).trim();


  const address =
    String(
      $("addr")?.value ||
      ""
    ).trim();


  const status =
    $("status");


  function showError(
    message
  ) {

    if (!status) return;


    status.textContent =
      message;


    status.classList.remove(
      "hidden"
    );


    status.style.color =
      "#b00020";

  }


  if (!name) {

    showError(
      "من فضلك اكتب الاسم."
    );

    return;
  }


  if (
    !validatePhone(phone)
  ) {

    showError(
      "من فضلك اكتب رقم موبايل صحيح."
    );

    return;
  }


  if (!address) {

    showError(
      "من فضلك اكتب العنوان بالتفصيل."
    );

    return;
  }


  if (!customerLocation) {

    showError(
      "من فضلك حدد موقعك على الخريطة أولًا."
    );

    return;
  }


  const items =
    getCartItems();


  if (!items.length) {

    showError(
      "السلة فارغة."
    );

    return;
  }


  const total =
    items.reduce(
      (sum, item) =>
        sum + item.total,
      0
    );


  const sendButton =
    $("send");


  if (sendButton) {

    sendButton.disabled =
      true;

    sendButton.textContent =
      "⏳ جاري إرسال الطلب...";

  }


  try {

    const orderData = {

      name,

      phone,

      address,

      items,

      total,

      status:
        "new",

      createdAt:
        serverTimestamp(),


      customerLocation: {

        lat:
          customerLocation.lat,

        lng:
          customerLocation.lng,

        accuracy:
          customerLocation.accuracy,

        mapUrl:
          customerLocation.mapUrl

      },


      lat:
        customerLocation.lat,

      lng:
        customerLocation.lng,

      mapUrl:
        customerLocation.mapUrl,


      store: {

        whatsapp:
          storeWhatsapp,

        location:
          storeLocation

      },


      storeWhatsapp,

      storeLocation

    };


    await addDoc(
      collection(
        db,
        "orders"
      ),
      orderData
    );


    const waNumber =
      getInternationalWhatsapp(
        storeWhatsapp
      );


    if (!waNumber) {

      throw new Error(
        "رقم واتساب المحل غير مضبوط في إعدادات المتجر."
      );

    }


    let message =
      "🛒 *طلب جديد من دلوقتي ماركت*\n\n";


    message +=
      `👤 الاسم: ${name}\n`;


    message +=
      `📱 الهاتف: ${phone}\n`;


    message +=
      `📍 العنوان: ${address}\n\n`;


    message +=
      "🧾 *المنتجات:*\n";


    items.forEach(item => {

      message +=
        `• ${item.name} × ${item.qty} = ` +
        `${formatPrice(item.total)} ج\n`;

    });


    message +=
      `\n💰 *الإجمالي: ${formatPrice(total)} جنيه*\n`;


    message +=
      "\n📍 *موقع العميل:*\n" +
      `${customerLocation.mapUrl}\n`;


    if (storeLocation) {

      message +=
        "\n🏪 *موقع المحل:*\n" +
        `${storeLocation}\n`;

    }


    message +=
      `\n📞 واتساب المحل: ${storeWhatsapp}`;


    const whatsappUrl =
      "https://wa.me/" +
      `${waNumber}?text=` +
      encodeURIComponent(
        message
      );


    cart = {};

    saveCart();

    updateCart();

    renderProducts();


    if (status) {

      status.textContent =
        "تم تسجيل الطلب بنجاح ✅ سيتم فتح واتساب لإرسال التفاصيل.";


      status.classList.remove(
        "hidden"
      );


      status.style.color =
        "#16803c";

    }


    window.location.href =
      whatsappUrl;

  } catch (error) {

    console.error(
      "Order error:",
      error
    );


    showError(
      "حدث خطأ أثناء إرسال الطلب. حاول مرة أخرى."
    );


    if (sendButton) {

      sendButton.disabled =
        false;

      sendButton.textContent =
        "تأكيد الطلب";

    }

  }

}


/* =========================
   المنتجات من Firebase
========================= */

function listenProducts() {

  const productsQuery =
    query(
      collection(
        db,
        "products"
      ),
      orderBy("name")
    );


  onSnapshot(

    productsQuery,

    snapshot => {

      products =
        snapshot.docs
          .map(item =>
            normalizeProduct(
              item.id,
              item.data()
            )
          )
          .filter(product => {

            return (
              product.name &&
              Number.isFinite(
                product.price
              ) &&
              product.price >= 0
            );

          });


      const validIds =
        new Set(
          products.map(
            p => p.id
          )
        );


      Object.keys(cart)
        .forEach(id => {

          if (
            !validIds.has(id)
          ) {

            delete cart[id];

            return;

          }


          const product =
            products.find(
              p => p.id === id
            );


          const qty =
            Number(
              cart[id] || 0
            );


          if (
            !product ||
            product.stock <= 0
          ) {

            delete cart[id];

          } else if (
            qty >
            product.stock
          ) {

            cart[id] =
              product.stock;

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


      const empty =
        $("empty");


      if (empty) {

        empty.textContent =
          "تعذر تحميل المنتجات حاليًا.";

        empty.classList.remove(
          "hidden"
        );

      }

    }

  );

}


/* =========================
   البحث
========================= */

function setupSearch() {

  const search =
    $("q");


  if (!search) {
    return;
  }


  const clear =
    $("clearSearch");


  search.addEventListener(
    "input",
    () => {

      renderProducts();


      if (clear) {

        clear.classList.toggle(
          "hidden",
          !search.value
        );

      }

    }
  );


  clear?.addEventListener(
    "click",
    () => {

      search.value = "";

      clear.classList.add(
        "hidden"
      );

      renderProducts();

      search.focus();

    }
  );

}


/* =========================
   الواجهة
========================= */

function setupUI() {

  $("getLocation")
    ?.addEventListener(
      "click",
      setCustomerLocation
    );


  $("send")
    ?.addEventListener(
      "click",
      sendOrder
    );


  $("toggle")
    ?.addEventListener(
      "click",
      () => {

        $("detail")
          ?.classList
          .toggle(
            "hidden"
          );

      }
    );

}


/* =========================
   التشغيل
========================= */

async function init() {

  setupSearch();

  setupUI();

  await loadStoreSettings();

  updateWhatsappButton();

  listenProducts();

  updateCart();

}


init().catch(
  error => {

    console.error(
      "Application initialization error:",
      error
    );

  }
);
