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

let products = [];
let cart = {};
let storeWhatsapp = "";

// ===============================
// تحميل السلة من الجهاز
// ===============================
try {
  const saved = JSON.parse(localStorage.getItem("cart") || "{}");

  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    cart = saved;
  }
} catch {
  cart = {};
}

// ===============================
// أدوات مساعدة
// ===============================

const saveCart = () => {
  localStorage.setItem("cart", JSON.stringify(cart));
};

const fmt = number => {
  const value = Number(number) || 0;
  return value.toLocaleString("ar-EG") + " ج.م";
};

const normalizeText = value => {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("ar-EG");
};

const safeImageUrl = url => {
  if (!url) return "";

  try {
    const parsed = new URL(String(url), window.location.href);

    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }

    return "";
  } catch {
    return "";
  }
};

const getProduct = id => {
  return products.find(product => product.id === id);
};

// ===============================
// Firebase - المنتجات
// ===============================

onSnapshot(
  collection(db, "products"),
  snapshot => {
    products = snapshot.docs
      .map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .filter(product => product.active !== false);

    // تنظيف السلة من المنتجات التي لم تعد موجودة
    // أو أصبحت غير متاحة
    let changed = false;

    for (const id of Object.keys(cart)) {
      const product = getProduct(id);

      if (!product) {
        delete cart[id];
        changed = true;
        continue;
      }

      const stock = Math.max(0, Number(product.stock) || 0);

      if (stock <= 0) {
        delete cart[id];
        changed = true;
        continue;
      }

      const currentQty = Math.max(0, Number(cart[id]) || 0);

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

    renderList();
    renderCart();
  },
  error => {
    console.error("Products listener error:", error);

    $("#empty").classList.remove("hidden");
    $("#empty").textContent =
      "تعذر تحميل المنتجات حاليًا. حاول تحديث الصفحة.";
  }
);

// ===============================
// Firebase - إعدادات المتجر
// ===============================

onSnapshot(
  doc(db, "settings", "store"),
  snapshot => {
    if (!snapshot.exists()) {
      storeWhatsapp = "";
      $("#wa").classList.add("hidden");
      return;
    }

    const data = snapshot.data() || {};
    const whatsapp = String(data.whatsapp || "").replace(/\D/g, "");

    storeWhatsapp = whatsapp;

    if (whatsapp) {
      $("#wa").href = "https://wa.me/" + whatsapp;
      $("#wa").classList.remove("hidden");
    } else {
      $("#wa").classList.add("hidden");
    }
  },
  error => {
    console.error("Store settings error:", error);
  }
);

// ===============================
// عرض المنتجات
// ===============================

function renderList() {
  const query = normalizeText($("#q").value);

  const items = products.filter(product => {
    const name = normalizeText(product.name);
    return !query || name.includes(query);
  });

  $("#empty").classList.toggle("hidden", items.length > 0);

  if (!items.length) {
    $("#list").innerHTML = "";
    return;
  }

  $("#list").innerHTML = items
    .map(product => {
      const stock = Math.max(0, Number(product.stock) || 0);
      const price = Math.max(0, Number(product.price) || 0);
      const out = stock <= 0;

      const image = safeImageUrl(product.image);

      return `
        <div class="card">

          ${
            image
              ? `
                <img
                  src="${esc(image)}"
                  alt="${esc(product.name || "منتج")}"
                  loading="lazy"
                  onerror="this.style.display='none'"
                >
              `
              : `
                <div class="product-placeholder">
                  لا توجد صورة
                </div>
              `
          }

          <div class="product-name">
            ${esc(product.name || "منتج بدون اسم")}
          </div>

          <div class="price">
            ${fmt(price)}
          </div>

          ${
            stock > 0
              ? `<small>المتاح: ${stock}</small>`
              : `<small>غير متوفر حاليًا</small>`
          }

          <button
            class="sun"
            data-add="${esc(product.id)}"
            ${out ? "disabled" : ""}
            style="width:100%;margin-top:.4rem"
          >
            ${out ? "نفد" : "أضف للسلة"}
          </button>

        </div>
      `;
    })
    .join("");
}

// ===============================
// البحث
// ===============================

$("#q").addEventListener("input", renderList);

// ===============================
// إضافة منتج للسلة
// ===============================

$("#list").addEventListener("click", event => {
  const button = event.target.closest("[data-add]");

  if (!button) return;

  const id = button.dataset.add;
  const product = getProduct(id);

  if (!product) {
    say("المنتج غير موجود.", true);
    return;
  }

  const stock = Math.max(0, Number(product.stock) || 0);

  if (stock <= 0) {
    say("هذا المنتج غير متوفر حاليًا.", true);
    return;
  }

  const currentQty = Math.max(0, Number(cart[id]) || 0);

  if (currentQty >= stock) {
    say(`لا يمكن إضافة أكثر من ${stock} قطعة من هذا المنتج.`, true);
    return;
  }

  cart[id] = currentQty + 1;

  saveCart();
  renderCart();
});

// ===============================
// الحصول على منتجات السلة
// ===============================

function lines() {
  return Object.entries(cart)
    .map(([id, quantity]) => {
      const product = getProduct(id);

      if (!product) return null;

      const qty = Math.max(0, Number(quantity) || 0);
      const stock = Math.max(0, Number(product.stock) || 0);

      if (qty <= 0 || stock <= 0) {
        return null;
      }

      return {
        id,
        name: String(product.name || "منتج"),
        price: Math.max(0, Number(product.price) || 0),
        qty: Math.min(qty, stock)
      };
    })
    .filter(Boolean);
}

// ===============================
// حساب إجمالي السلة
// ===============================

function getCartTotal(items = lines()) {
  return items.reduce((total, item) => {
    return total + item.price * item.qty;
  }, 0);
}

// ===============================
// عرض السلة
// ===============================

function renderCart() {
  const items = lines();
  const total = getCartTotal(items);

  const totalQuantity = items.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  $("#cart").classList.toggle("hidden", items.length === 0);

  $("#sum").textContent =
    `${totalQuantity} منتج — ${fmt(total)}`;

  $("#lines").innerHTML = items
    .map(item => {
      return `
        <div class="row cart-line">

          <span>
            ${esc(item.name)}
            <small>${fmt(item.price)} × ${item.qty}</small>
          </span>

          <span>
            <button
              class="ghost"
              data-dec="${esc(item.id)}"
              type="button"
              aria-label="تقليل الكمية"
            >
              −
            </button>

            ${item.qty}

            <button
              class="ghost"
              data-inc="${esc(item.id)}"
              type="button"
              aria-label="زيادة الكمية"
            >
              +
            </button>
          </span>

        </div>
      `;
    })
    .join("");
}

// ===============================
// فتح / إغلاق تفاصيل السلة
// ===============================

$("#toggle").addEventListener("click", () => {
  const detail = $("#detail");

  detail.classList.toggle("hidden");

  $("#toggle").textContent =
    detail.classList.contains("hidden")
      ? "عرض السلة"
      : "إخفاء";
});

// ===============================
// تعديل كمية المنتج
// ===============================

$("#lines").addEventListener("click", event => {
  const increaseButton = event.target.closest("[data-inc]");
  const decreaseButton = event.target.closest("[data-dec]");

  const id =
    increaseButton?.dataset.inc ||
    decreaseButton?.dataset.dec;

  if (!id) return;

  const product = getProduct(id);

  if (!product) {
    delete cart[id];
    saveCart();
    renderCart();
    return;
  }

  const stock = Math.max(0, Number(product.stock) || 0);
  let quantity = Math.max(0, Number(cart[id]) || 0);

  if (increaseButton) {
    if (quantity >= stock) {
      say(`المتاح فقط ${stock} قطعة من هذا المنتج.`, true);
      return;
    }

    quantity++;
  }

  if (decreaseButton) {
    quantity--;
  }

  if (quantity <= 0) {
    delete cart[id];
  } else {
    cart[id] = Math.min(quantity, stock);
  }

  saveCart();
  renderCart();
});

// ===============================
// رسائل الحالة
// ===============================

function say(message, error = false) {
  const status = $("#status");

  status.textContent = message;

  status.className = error
    ? "msg err"
    : "msg";

  status.classList.remove("hidden");
}

// ===============================
// التحقق من رقم الهاتف
// ===============================

function validPhone(phone) {
  const digits = String(phone).replace(/\D/g, "");

  return digits.length >= 8 && digits.length <= 15;
}

// ===============================
// إنشاء رسالة واتساب
// ===============================

function createWhatsappMessage(orderId, name, phone, address, items, total) {
  const productText = items
    .map(item => {
      return `- ${item.name} × ${item.qty} = ${fmt(item.price * item.qty)}`;
    })
    .join("\n");

  return `طلب جديد من دلوقتي ماركت

رقم الطلب: ${orderId}

الاسم: ${name}
الموبايل: ${phone}
العنوان: ${address}

المنتجات:
${productText}

الإجمالي: ${fmt(total)}

شكرًا لاختيارك دلوقتي ماركت.`;
}

// ===============================
// إرسال الطلب
// ===============================

$("#send").addEventListener("click", async () => {
  const items = lines();

  const name = $("#name").value.trim();
  const phone = $("#phone").value.trim();
  const address = $("#addr").value.trim();

  // -------------------------------
  // التحقق من البيانات
  // -------------------------------

  if (!items.length) {
    say("السلة فارغة.", true);
    return;
  }

  if (!name) {
    say("اكتب الاسم.", true);
    $("#name").focus();
    return;
  }

  if (!validPhone(phone)) {
    say("اكتب رقم موبايل صحيح.", true);
    $("#phone").focus();
    return;
  }

  if (!address) {
    say("اكتب العنوان بالتفصيل.", true);
    $("#addr").focus();
    return;
  }

  // -------------------------------
  // تحديث الكميات قبل الإرسال
  // -------------------------------

  for (const item of items) {
    const product = getProduct(item.id);

    if (!product) {
      delete cart[item.id];
      saveCart();
      renderCart();

      say(`المنتج "${item.name}" لم يعد متوفرًا.`, true);
      return;
    }

    const stock = Math.max(0, Number(product.stock) || 0);

    if (stock < item.qty) {
      cart[item.id] = stock;

      if (stock <= 0) {
        delete cart[item.id];
      }

      saveCart();
      renderCart();

      say(
        `الكمية المتاحة من "${item.name}" أصبحت ${stock}.`,
        true
      );

      return;
    }
  }

  const finalItems = lines();
  const total = getCartTotal(finalItems);

  if (!finalItems.length) {
    say("السلة فارغة.", true);
    return;
  }

  // -------------------------------
  // منع الضغط مرتين
  // -------------------------------

  const sendButton = $("#send");

  if (sendButton.disabled) return;

  sendButton.disabled = true;
  sendButton.textContent = "جاري إرسال الطلب...";

  try {
    // -------------------------------
    // إنشاء الطلب
    // -------------------------------

    const orderData = {
      name,
      phone,
      address,

      items: finalItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: item.qty
      })),

      total,

      status: "new",

      createdAt: serverTimestamp()
    };

    const orderRef = await addDoc(
      collection(db, "orders"),
      orderData
    );

    // -------------------------------
    // تفريغ السلة
    // -------------------------------

    cart = {};

    saveCart();
    renderCart();

    // -------------------------------
    // إخفاء التفاصيل
    // -------------------------------

    $("#detail").classList.add("hidden");
    $("#toggle").textContent = "عرض السلة";

    // -------------------------------
    // عرض نجاح الطلب
    // -------------------------------

    say(
      `تم استلام طلبك بنجاح ✅ رقم الطلب: ${orderRef.id}`
    );

    // -------------------------------
    // فتح واتساب برسالة جاهزة
    // -------------------------------

    if (storeWhatsapp) {
      const message = createWhatsappMessage(
        orderRef.id,
        name,
        phone,
        address,
        finalItems,
        total
      );

      const whatsappUrl =
        "https://wa.me/" +
        storeWhatsapp +
        "?text=" +
        encodeURIComponent(message);

      // نفتح واتساب في نفس اللحظة بعد تفاعل المستخدم
      window.open(
        whatsappUrl,
        "_blank",
        "noopener,noreferrer"
      );
    }

    // -------------------------------
    // تنظيف بيانات العميل
    // -------------------------------

    $("#name").value = "";
    $("#phone").value = "";
    $("#addr").value = "";

  } catch (error) {
    console.error("Order error:", error);

    say(
      "تعذر إرسال الطلب حاليًا. تأكد من اتصال الإنترنت وحاول مرة أخرى.",
      true
    );
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "تأكيد الطلب";
  }
});
