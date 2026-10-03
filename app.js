import {
  db,
  esc,
  collection,
  doc,
  getDoc,
  addDoc,
  onSnapshot,
  serverTimestamp
} from "./config.js";


/* =========================================================
   الأقسام
========================================================= */

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


/* =========================================================
   المتغيرات
========================================================= */

let products = [];

let selectedCategory = "all";

let storeWhatsapp = "";
let storeLocation = "";

let customerLocation = null;


/* =========================================================
   عناصر الصفحة
========================================================= */

const list =
  document.getElementById("list");

const empty =
  document.getElementById("empty");

const categoriesBox =
  document.getElementById("categories");

const productsCount =
  document.getElementById("productsCount");

const searchInput =
  document.getElementById("q");

const clearSearch =
  document.getElementById("clearSearch");

const cartBox =
  document.getElementById("cart");

const cartSum =
  document.getElementById("sum");

const cartLines =
  document.getElementById("lines");

const cartToggle =
  document.getElementById("toggle");

const nameInput =
  document.getElementById("name");

const phoneInput =
  document.getElementById("phone");

const addressInput =
  document.getElementById("addr");

const locationStatus =
  document.getElementById("locationStatus");

const getLocationBtn =
  document.getElementById("getLocation");

const customerMap =
  document.getElementById("customerMap");

const orderStatus =
  document.getElementById("status");

const sendButton =
  document.getElementById("send");

const whatsappLink =
  document.getElementById("wa");


/* =========================================================
   الأسعار
========================================================= */

function formatPrice(value) {

  const number =
    Number(value || 0);

  return number.toLocaleString(
    "ar-EG",
    {
      maximumFractionDigits: 2
    }
  );
}


/* =========================================================
   السلة
========================================================= */

function getCart() {

  try {

    const cart =
      JSON.parse(
        localStorage.getItem("cart") || "{}"
      );

    if (
      !cart ||
      typeof cart !== "object" ||
      Array.isArray(cart)
    ) {

      return {};

    }

    return cart;

  } catch (error) {

    console.error(
      "Cart error:",
      error
    );

    return {};
  }
}


function saveCart(cart) {

  localStorage.setItem(
    "cart",
    JSON.stringify(cart)
  );
}


/* =========================================================
   الأقسام
========================================================= */

function getCategory(product) {

  const category =
    product?.category;

  if (!category) {
    return "أخرى";
  }

  const exists =
    CATEGORIES.some(
      item =>
        item.id === category
    );

  return exists
    ? category
    : "أخرى";
}


function getCategoryInfo(category) {

  return (
    CATEGORIES.find(
      item =>
        item.id === category
    ) ||
    {
      id: "أخرى",
      name: "أخرى",
      icon: "📦"
    }
  );
}


function renderCategories() {

  if (!categoriesBox) {
    return;
  }

  categoriesBox.innerHTML =
    CATEGORIES.map(category => {

      const active =
        selectedCategory === category.id
          ? "active"
          : "";

      return `
        <button
          type="button"
          class="category-btn ${active}"
          data-category="${esc(category.id)}"
        >
          <span class="category-icon">
            ${category.icon}
          </span>

          <span>
            ${esc(category.name)}
          </span>
        </button>
      `;

    }).join("");


  categoriesBox
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


/* =========================================================
   تحويل بيانات Firebase
========================================================= */

function normalizeProduct(snapshot) {

  const data =
    snapshot.data() || {};

  return {

    id:
      snapshot.id,

    name:
      String(
        data.name || "منتج"
      ).trim(),

    price:
      Number(
        data.price || 0
      ),

    stock:
      Number(
        data.stock || 0
      ),

    image:
      String(
        data.image || ""
      ).trim(),

    category:
      getCategory(data),

    description:
      String(
        data.description || ""
      ).trim(),

    active:
      data.active !== false

  };
}


/* =========================================================
   تنظيف السلة
========================================================= */

function cleanCart() {

  const cart =
    getCart();

  let changed = false;


  Object.keys(cart)
    .forEach(id => {

      const product =
        products.find(
          item =>
            item.id === id
        );


      if (
        !product ||
        !product.active
      ) {

        delete cart[id];

        changed = true;

        return;
      }


      const stock =
        Number(
          product.stock || 0
        );


      if (stock <= 0) {

        delete cart[id];

        changed = true;

        return;
      }


      let qty =
        Number(
          cart[id]?.qty || 1
        );


      qty =
        Math.max(
          1,
          Math.min(
            qty,
            stock
          )
        );


      if (
        Number(cart[id].qty) !== qty
      ) {

        cart[id].qty =
          qty;

        changed = true;
      }


      if (
        cart[id].name !==
        product.name
      ) {

        cart[id].name =
          product.name;

        changed = true;
      }


      if (
        Number(cart[id].price) !==
        Number(product.price)
      ) {

        cart[id].price =
          product.price;

        changed = true;
      }


      if (
        cart[id].image !==
        product.image
      ) {

        cart[id].image =
          product.image;

        changed = true;
      }


      if (
        cart[id].category !==
        product.category
      ) {

        cart[id].category =
          product.category;

        changed = true;
      }

    });


  if (changed) {

    saveCart(cart);

  }


  return cart;
}


/* =========================================================
   إضافة للسلة
========================================================= */

function addToCart(
  productId,
  quantity = 1
) {

  const product =
    products.find(
      item =>
        item.id === productId
    );


  if (!product) {
    return;
  }


  const stock =
    Number(
      product.stock || 0
    );


  if (stock <= 0) {

    showStatus(
      "المنتج غير متوفر حالياً.",
      true
    );

    renderProducts();

    return;
  }


  const cart =
    getCart();


  const currentQty =
    Number(
      cart[productId]?.qty || 0
    );


  const requestedQuantity =
    Number(
      quantity || 1
    );


  const newQty =
    Math.min(
      currentQty +
        requestedQuantity,
      stock
    );


  cart[productId] = {

    id:
      product.id,

    name:
      product.name,

    price:
      product.price,

    image:
      product.image,

    category:
      product.category,

    qty:
      newQty

  };


  saveCart(cart);


  /*
    تحديث المنتجات فوراً حتى يتحول
    زر "أضف للسلة" إلى
    − الكمية +
  */

  renderProducts();

  renderCart();


  if (
    newQty >= stock &&
    currentQty < stock
  ) {

    showStatus(
      `تمت الإضافة. الحد الأقصى المتاح ${stock} قطعة.`
    );

  } else {

    showStatus(
      "تمت إضافة المنتج إلى السلة ✓"
    );

  }
}


/* =========================================================
   تغيير كمية
========================================================= */

function changeQuantity(
  productId,
  amount
) {

  const cart =
    getCart();


  if (!cart[productId]) {
    return;
  }


  const product =
    products.find(
      item =>
        item.id === productId
    );


  if (!product) {

    delete cart[productId];

    saveCart(cart);

    renderProducts();

    renderCart();

    return;
  }


  const stock =
    Number(
      product.stock || 0
    );


  if (stock <= 0) {

    delete cart[productId];

    saveCart(cart);

    renderProducts();

    renderCart();

    return;
  }


  let qty =
    Number(
      cart[productId].qty || 1
    ) +
    Number(
      amount || 0
    );


  if (qty <= 0) {

    delete cart[productId];

  } else {

    qty =
      Math.min(
        qty,
        stock
      );

    cart[productId].qty =
      qty;
  }


  saveCart(cart);


  /*
    تحديث كروت المنتجات والسلة
  */

  renderProducts();

  renderCart();
}


/* =========================================================
   حذف منتج
========================================================= */

function removeFromCart(
  productId
) {

  const cart =
    getCart();

  delete cart[productId];

  saveCart(cart);


  renderProducts();

  renderCart();
}


/* =========================================================
   فتح تفاصيل المنتج
========================================================= */

function openProduct(productId) {

  if (!productId) {
    return;
  }

  window.location.href =
    `product.html?id=${encodeURIComponent(productId)}`;
}


/* =========================================================
   رسم المنتجات
========================================================= */

function renderProducts() {

  if (!list) {
    return;
  }


  /*
    تحديث السلة قبل الرسم
    حتى تظهر الكمية الحالية
    على كارت المنتج.
  */

  const cart =
    cleanCart();


  const search =
    String(
      searchInput?.value || ""
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
        getCategory(product) !==
          selectedCategory
      ) {

        return false;
      }


      if (!search) {
        return true;
      }


      const name =
        product.name
          .toLowerCase();


      const category =
        getCategory(product)
          .toLowerCase();


      const description =
        String(
          product.description || ""
        )
          .toLowerCase();


      return (
        name.includes(search) ||
        category.includes(search) ||
        description.includes(search)
      );

    });


  /* =======================================================
     عداد المنتجات
  ======================================================= */

  if (productsCount) {

    productsCount.textContent =
      filtered.length
        ? `${filtered.length} منتج`
        : "";

  }


  /* =======================================================
     لا توجد منتجات
  ======================================================= */

  if (!filtered.length) {

    list.innerHTML = "";

    if (empty) {

      empty.classList.remove(
        "hidden"
      );

      empty.textContent =
        search ||
        selectedCategory !== "all"
          ? "لا توجد منتجات مطابقة."
          : "لا توجد منتجات متاحة حالياً.";

    }

    return;
  }


  if (empty) {

    empty.classList.add(
      "hidden"
    );

  }


  /* =======================================================
     كروت المنتجات
  ======================================================= */

  list.innerHTML =
    filtered.map(product => {

      const category =
        getCategoryInfo(
          getCategory(product)
        );


      const stock =
        Number(
          product.stock || 0
        );


      const currentQty =
        Number(
          cart[product.id]?.qty || 0
        );


      const inCart =
        currentQty > 0;


      const outOfStock =
        stock <= 0;


      /* =====================================================
         صورة المنتج
      ===================================================== */

      let image;


      if (product.image) {

        image = `
          <img
            src="${esc(product.image)}"
            alt="${esc(product.name)}"
            loading="lazy"
            onerror="
              this.style.display='none';
              this.parentElement.classList.add('no-image')
            "
          `;

        image += `>`;

      } else {

        image = `
          <div class="product-placeholder">
            ${category.icon}
          </div>
        `;

      }


      /* =====================================================
         زر المنتج
      ===================================================== */

      let actionHtml = "";


      /*
        المنتج غير متوفر
      */

      if (outOfStock) {

        actionHtml = `
          <button
            class="product-add disabled"
            type="button"
            disabled
            aria-label="${esc(product.name)} غير متوفر"
          >
            <span class="add-icon">
              ×
            </span>

            <span>
              غير متوفر
            </span>
          </button>
        `;

      }


      /*
        المنتج موجود في السلة
        يتحول إلى:
        −   الكمية   +
      */

      else if (inCart) {

        actionHtml = `
          <div
            class="product-qty-control"
            data-qty-control="${esc(product.id)}"
            role="group"
            aria-label="التحكم في كمية ${esc(product.name)}"
          >

            <button
              type="button"
              class="product-qty product-qty-plus"
              data-product-plus="${esc(product.id)}"
              aria-label="زيادة كمية ${esc(product.name)}"
            >
              +
            </button>


            <span
              class="product-qty-value"
              aria-live="polite"
            >
              ${currentQty}
            </span>


            <button
              type="button"
              class="product-qty product-qty-minus"
              data-product-minus="${esc(product.id)}"
              aria-label="تقليل كمية ${esc(product.name)}"
            >
              −
            </button>

          </div>
        `;

      }


      /*
        المنتج غير موجود في السلة
      */

      else {

        actionHtml = `
          <button
            class="product-add"
            type="button"
            data-add="${esc(product.id)}"
            aria-label="إضافة ${esc(product.name)} للسلة"
          >

            <span class="add-icon">
              +
            </span>

            <span>
              أضف للسلة
            </span>

          </button>
        `;

      }


      return `

        <article
          class="product-card"
          data-product-id="${esc(product.id)}"
        >

          <div
            class="product-click-area"
            data-open-product="${esc(product.id)}"
            tabindex="0"
            role="button"
            aria-label="عرض ${esc(product.name)}"
          >

            <div class="product-image">

              ${image}

            </div>


            <div class="product-details">

              <div class="product-category">

                <span>
                  ${category.icon}
                </span>

                <span>
                  ${esc(category.name)}
                </span>

              </div>


              <h3>
                ${esc(product.name)}
              </h3>


              ${
                product.description
                  ? `
                    <p class="product-description">
                      ${esc(product.description)}
                    </p>
                  `
                  : ""
              }


              <div class="product-price">

                <strong>
                  ${formatPrice(product.price)}
                </strong>

                <span>
                  جنيه
                </span>

              </div>

            </div>

          </div>


          <div class="product-card-action">

            ${actionHtml}

          </div>

        </article>

      `;

    }).join("");


  /* =======================================================
     فتح تفاصيل المنتج
  ======================================================= */

  list
    .querySelectorAll(
      "[data-open-product]"
    )
    .forEach(area => {

      area.addEventListener(
        "click",
        event => {

          /*
            لو الضغط على زر كمية
            لا نفتح تفاصيل المنتج.
          */

          if (
            event.target.closest(
              "button"
            )
          ) {
            return;
          }


          const id =
            area.dataset.openProduct;


          if (!id) {
            return;
          }


          openProduct(id);

        }
      );


      area.addEventListener(
        "keydown",
        event => {

          if (
            event.key !== "Enter" &&
            event.key !== " "
          ) {
            return;
          }


          event.preventDefault();


          const id =
            area.dataset.openProduct;


          if (!id) {
            return;
          }


          openProduct(id);

        }
      );

    });


  /* =======================================================
     زر الإضافة الأولى
  ======================================================= */

  list
    .querySelectorAll(
      "[data-add]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          event.stopPropagation();


          const id =
            button.dataset.add;


          if (!id) {
            return;
          }


          addToCart(
            id,
            1
          );

        }
      );

    });


  /* =======================================================
     زر زيادة الكمية
  ======================================================= */

  list
    .querySelectorAll(
      "[data-product-plus]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          event.stopPropagation();


          const id =
            button.dataset.productPlus;


          if (!id) {
            return;
          }


          const product =
            products.find(
              item =>
                item.id === id
            );


          if (!product) {
            return;
          }


          const cartNow =
            getCart();


          const current =
            Number(
              cartNow[id]?.qty || 0
            );


          const stock =
            Number(
              product.stock || 0
            );


          if (current >= stock) {

            showStatus(
              `لا يمكن إضافة كمية أكبر من المتاح (${stock}).`,
              true
            );

            return;
          }


          addToCart(
            id,
            1
          );

        }
      );

    });


  /* =======================================================
     زر تقليل الكمية
  ======================================================= */

  list
    .querySelectorAll(
      "[data-product-minus]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();

          event.stopPropagation();


          const id =
            button.dataset.productMinus;


          if (!id) {
            return;
          }


          changeQuantity(
            id,
            -1
          );

        }
      );

    });
}


/* =========================================================
   رسم السلة
========================================================= */

function renderCart() {

  if (!cartBox) {
    return;
  }


  const cart =
    cleanCart();


  const items =
    Object.values(cart);


  if (!items.length) {

    cartBox.classList.add(
      "hidden"
    );


    if (cartLines) {
      cartLines.innerHTML = "";
    }


    if (cartSum) {

      cartSum.textContent =
        "السلة فارغة";

    }


    return;
  }


  cartBox.classList.remove(
    "hidden"
  );


  let total = 0;

  let count = 0;


  if (cartLines) {

    cartLines.innerHTML =
      items.map(item => {

        const qty =
          Number(
            item.qty || 0
          );


        const price =
          Number(
            item.price || 0
          );


        const lineTotal =
          qty * price;


        total +=
          lineTotal;


        count +=
          qty;


        return `

          <div class="cart-line">

            <div class="cart-line-image">

              ${
                item.image

                  ? `
                    <img
                      src="${esc(item.image)}"
                      alt="${esc(item.name)}"
                    >
                  `

                  : `
                    <span>
                      🛒
                    </span>
                  `
              }

            </div>


            <div class="cart-line-info">

              <strong>
                ${esc(item.name)}
              </strong>


              <small>
                ${formatPrice(price)}
                جنيه
              </small>


              <div class="cart-line-controls">

                <button
                  type="button"
                  data-cart-minus="${esc(item.id)}"
                >
                  −
                </button>


                <strong>
                  ${qty}
                </strong>


                <button
                  type="button"
                  data-cart-plus="${esc(item.id)}"
                >
                  +
                </button>


                <button
                  type="button"
                  class="cart-remove"
                  data-cart-remove="${esc(item.id)}"
                >
                  حذف
                </button>

              </div>

            </div>


            <strong class="cart-line-total">

              ${formatPrice(lineTotal)}
              جنيه

            </strong>

          </div>

        `;

      }).join("");

  }


  if (cartSum) {

    cartSum.textContent =
      `${formatPrice(total)} جنيه — ${count} منتج`;

  }


  /* =======================================================
     ناقص
  ======================================================= */

  cartLines
    ?.querySelectorAll(
      "[data-cart-minus]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          changeQuantity(
            button.dataset.cartMinus,
            -1
          );

        }
      );

    });


  /* =======================================================
     زائد
  ======================================================= */

  cartLines
    ?.querySelectorAll(
      "[data-cart-plus]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          changeQuantity(
            button.dataset.cartPlus,
            1
          );

        }
      );

    });


  /* =======================================================
     حذف
  ======================================================= */

  cartLines
    ?.querySelectorAll(
      "[data-cart-remove]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          removeFromCart(
            button.dataset.cartRemove
          );

        }
      );

    });
}


/* =========================================================
   رسائل
========================================================= */

function showStatus(
  message,
  error = false
) {

  if (!orderStatus) {
    return;
  }


  orderStatus.textContent =
    message;


  orderStatus.classList.remove(
    "hidden"
  );


  orderStatus.classList.toggle(
    "error",
    error
  );
}


/* =========================================================
   تحديد موقع العميل
========================================================= */

function setupLocation() {

  if (!getLocationBtn) {
    return;
  }


  getLocationBtn.addEventListener(
    "click",
    () => {

      if (
        !navigator.geolocation
      ) {

        showStatus(
          "المتصفح لا يدعم تحديد الموقع.",
          true
        );

        return;
      }


      getLocationBtn.disabled =
        true;


      getLocationBtn.textContent =
        "جاري تحديد موقعك...";


      if (locationStatus) {

        locationStatus.textContent =
          "جاري الحصول على موقعك الحالي...";

      }


      navigator.geolocation.getCurrentPosition(

        position => {

          const latitude =
            position.coords.latitude;

          const longitude =
            position.coords.longitude;

          const accuracy =
            position.coords.accuracy;


          const mapUrl =
            `https://www.google.com/maps?q=${latitude},${longitude}`;


          customerLocation = {

            lat:
              latitude,

            lng:
              longitude,

            accuracy:
              Number.isFinite(
                accuracy
              )
                ? accuracy
                : null,

            mapUrl:
              mapUrl

          };


          if (locationStatus) {

            locationStatus.textContent =
              "تم تحديد موقعك بنجاح ✓";

          }


          if (customerMap) {

            customerMap.href =
              mapUrl;

            customerMap.classList.remove(
              "hidden"
            );

          }


          getLocationBtn.disabled =
            false;


          getLocationBtn.textContent =
            "📍 تحديث موقعي";

        },


        error => {

          console.error(
            "Location error:",
            error
          );


          let message =
            "تعذر تحديد موقعك.";


          if (
            error.code === 1
          ) {

            message =
              "تم رفض صلاحية الموقع. اسمح للموقع باستخدام موقعك ثم حاول مرة أخرى.";

          }


          if (
            error.code === 2
          ) {

            message =
              "تعذر الحصول على الموقع حالياً. حاول مرة أخرى.";

          }


          if (
            error.code === 3
          ) {

            message =
              "انتهى وقت تحديد الموقع. حاول مرة أخرى.";

          }


          if (locationStatus) {

            locationStatus.textContent =
              message;

          }


          getLocationBtn.disabled =
            false;


          getLocationBtn.textContent =
            "📍 تحديد موقعي على الخريطة";

        },


        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }

      );

    }
  );
}


/* =========================================================
   إعدادات المحل
========================================================= */

function normalizeWhatsapp(value) {

  let phone =
    String(value || "")
      .replace(
        /\D/g,
        ""
      );


  if (!phone) {
    return "";
  }


  if (
    phone.startsWith("00")
  ) {

    phone =
      phone.substring(2);

  }


  if (
    phone.startsWith("0")
  ) {

    phone =
      "20" +
      phone.substring(1);

  }


  return phone;
}


async function loadStoreSettings() {

  try {

    const settingsRef =
      doc(
        db,
        "settings",
        "store"
      );


    const snapshot =
      await getDoc(
        settingsRef
      );


    if (
      !snapshot.exists()
    ) {
      return;
    }


    const data =
      snapshot.data() || {};


    storeWhatsapp =
      normalizeWhatsapp(
        data.whatsapp
      );


    storeLocation =
      String(
        data.location || ""
      );


    if (
      whatsappLink &&
      storeWhatsapp
    ) {

      whatsappLink.href =
        `https://wa.me/${storeWhatsapp}`;

      whatsappLink.classList.remove(
        "hidden"
      );

    }

  } catch (error) {

    console.error(
      "Store settings error:",
      error
    );

  }
}


/* =========================================================
   إرسال الطلب
========================================================= */

async function sendOrder() {

  const cart =
    cleanCart();


  const cartItems =
    Object.values(cart);


  if (!cartItems.length) {

    showStatus(
      "السلة فارغة.",
      true
    );

    return;
  }


  const name =
    String(
      nameInput?.value || ""
    ).trim();


  const phone =
    String(
      phoneInput?.value || ""
    ).trim();


  const address =
    String(
      addressInput?.value || ""
    ).trim();


  if (!name) {

    showStatus(
      "اكتب اسمك أولاً.",
      true
    );

    nameInput?.focus();

    return;
  }


  if (
    phone.length < 8 ||
    phone.length > 20
  ) {

    showStatus(
      "اكتب رقم موبايل صحيح.",
      true
    );

    phoneInput?.focus();

    return;
  }


  if (!address) {

    showStatus(
      "اكتب عنوان التوصيل بالتفصيل.",
      true
    );

    addressInput?.focus();

    return;
  }


  if (!customerLocation) {

    showStatus(
      "يجب تحديد موقعك على الخريطة قبل تأكيد الطلب.",
      true
    );

    return;
  }


  const items =
    cartItems.map(item => {

      const price =
        Number(
          item.price || 0
        );

      const qty =
        Number(
          item.qty || 0
        );


      return {

        id:
          item.id,

        name:
          item.name,

        price:
          price,

        qty:
          qty,

        total:
          price * qty

      };

    });


  const total =
    items.reduce(
      (sum, item) =>
        sum + item.total,
      0
    );


  if (total <= 0) {

    showStatus(
      "إجمالي الطلب غير صحيح.",
      true
    );

    return;
  }


  const orderData = {

    name:
      name,

    phone:
      phone,

    address:
      address,

    items:
      items,

    total:
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
        storeWhatsapp || "",

      location:
        storeLocation || ""

    },


    storeWhatsapp:
      storeWhatsapp || "",

    storeLocation:
      storeLocation || ""

  };


  try {

    if (sendButton) {

      sendButton.disabled =
        true;

      sendButton.textContent =
        "جاري إرسال الطلب...";

    }


    showStatus(
      "جاري حفظ الطلب..."
   
