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

  const number = Number(value || 0);

  return number.toLocaleString("ar-EG", {
    maximumFractionDigits: 2
  });
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
      item => item.id === category
    );

  return exists
    ? category
    : "أخرى";
}


function getCategoryInfo(category) {

  return (
    CATEGORIES.find(
      item => item.id === category
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

    id: snapshot.id,

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
          item => item.id === id
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
        cart[id].qty !== qty
      ) {

        cart[id].qty =
          qty;

        changed = true;
      }


      cart[id].name =
        product.name;

      cart[id].price =
        product.price;

      cart[id].image =
        product.image;

      cart[id].category =
        product.category;

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

    return;
  }


  const cart =
    getCart();


  const currentQty =
    Number(
      cart[productId]?.qty || 0
    );


  const newQty =
    Math.min(
      currentQty +
        Number(quantity || 1),
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

  renderCart();

  showStatus(
    "تمت إضافة المنتج إلى السلة ✓"
  );
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

    renderCart();

    return;
  }


  const stock =
    Number(
      product.stock || 0
    );


  let qty =
    Number(
      cart[productId].qty || 1
    ) +
    Number(amount || 0);


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

  renderCart();
}


/* =========================================================
   رسم المنتجات
========================================================= */

function renderProducts() {

  if (!list) {
    return;
  }


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


      return (
        name.includes(search) ||
        category.includes(search)
      );

    });


  /* عداد المنتجات */

  if (productsCount) {

    productsCount.textContent =
      filtered.length
        ? `${filtered.length} منتج`
        : "";

  }


  /* لا توجد منتجات */

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


  list.innerHTML =
    filtered.map(product => {

      const category =
        getCategoryInfo(
          getCategory(product)
        );


      const image =
        product.image

          ? `
            <img
              src="${esc(product.image)}"
              alt="${esc(product.name)}"
              loading="lazy"
              onerror="this.style.display='none';this.parentElement.classList.add('no-image')"
            >
          `

          : `
            <div class="product-placeholder">
              ${category.icon}
            </div>
          `;


      return `

        <article
          class="product-card"
          data-product-id="${esc(product.id)}"
          tabindex="0"
          role="button"
        >

          <div class="product-image">

            ${image}

          </div>


          <div class="product-category">

            ${category.icon}
            ${esc(category.name)}

          </div>


          <h3>
            ${esc(product.name)}
          </h3>


          <div class="product-bottom">

            <strong>
              ${formatPrice(product.price)}
              جنيه
            </strong>


            <button
              class="sun add-btn"
              type="button"
              data-add="${esc(product.id)}"
              aria-label="إضافة ${esc(product.name)} للسلة"
            >
              +
            </button>

          </div>

        </article>

      `;

    }).join("");


  /* فتح تفاصيل المنتج */

  list
    .querySelectorAll(
      "[data-product-id]"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        event => {

          if (
            event.target.closest(
              "[data-add]"
            )
          ) {
            return;
          }


          const id =
            card.dataset.productId;


          if (!id) {
            return;
          }


          window.location.href =
            `product.html?id=${encodeURIComponent(id)}`;

        }
      );


      card.addEventListener(
        "keydown",
        event => {

          if (
            event.key !== "Enter" &&
            event.key !== " "
          ) {
            return;
          }


          if (
            event.target.closest(
              "[data-add]"
            )
          ) {
            return;
          }


          event.preventDefault();


          const id =
            card.dataset.productId;


          if (!id) {
            return;
          }


          window.location.href =
            `product.html?id=${encodeURIComponent(id)}`;

        }
      );

    });


  /* زر الإضافة السريعة */

  list
    .querySelectorAll(
      "[data-add]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

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
                    <span>🛒</span>
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


  /* ناقص */

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


  /* زائد */

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


  /* حذف */

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

           
