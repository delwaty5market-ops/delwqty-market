import {
  db,
  esc,
  collection,
  doc,
  getDoc,
  onSnapshot
} from "./config.js";

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const loading = document.getElementById("productLoading");
const details = document.getElementById("productDetails");
const notFound = document.getElementById("notFound");

const productImage = document.getElementById("productImage");
const productName = document.getElementById("productName");
const productCategory = document.getElementById("productCategory");
const productPrice = document.getElementById("productPrice");
const productDescription = document.getElementById("productDescription");

const minusQty = document.getElementById("minusQty");
const plusQty = document.getElementById("plusQty");
const productQty = document.getElementById("productQty");
const addProduct = document.getElementById("addProduct");
const productMessage = document.getElementById("productMessage");

const miniCart = document.getElementById("miniCart");
const miniCartCount = document.getElementById("miniCartCount");
const miniCartTotal = document.getElementById("miniCartTotal");

let product = null;
let quantity = 1;

function formatPrice(value) {
  const number = Number(value || 0);

  return number.toLocaleString("ar-EG", {
    maximumFractionDigits: 2
  });
}

function getCategory(product) {
  return product?.category || "أخرى";
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem("cart") || "{}");

    if (!cart || typeof cart !== "object") {
      return {};
    }

    return cart;
  } catch {
    return {};
  }
}

function updateMiniCart() {

  const cart = getCart();

  let count = 0;
  let total = 0;

  Object.values(cart).forEach(item => {

    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);

    count += qty;
    total += price * qty;

  });

  if (count <= 0) {
    miniCart.classList.add("hidden");
    return;
  }

  miniCart.classList.remove("hidden");

  miniCartCount.textContent =
    `${count} ${count === 1 ? "منتج" : "منتجات"}`;

  miniCartTotal.textContent =
    `${formatPrice(total)} جنيه`;
}

function showMessage(message) {

  productMessage.textContent = message;
  productMessage.classList.remove("hidden");

  setTimeout(() => {
    productMessage.classList.add("hidden");
  }, 2500);
}

function setQuantity(value) {

  if (!product) return;

  const stock = Number(product.stock);

  const max =
    Number.isFinite(stock) && stock > 0
      ? stock
      : 99;

  quantity = Math.max(1, Math.min(value, max));

  productQty.textContent = quantity;
}

function addToCart() {

  if (!product) return;

  const stock = Number(product.stock);

  if (stock <= 0) {
    showMessage("المنتج غير متوفر حالياً.");
    return;
  }

  const cart = getCart();

  const currentQty = Number(cart[productId]?.qty || 0);

  const max =
    Number.isFinite(stock) && stock > 0
      ? stock
      : 99;

  const newQty = Math.min(
    currentQty + quantity,
    max
  );

  cart[productId] = {
    id: productId,
    name: product.name,
    price: Number(product.price || 0),
    image: product.image || "",
    category: getCategory(product),
    qty: newQty
  };

  saveCart(cart);

  updateMiniCart();

  showMessage("تمت إضافة المنتج إلى السلة ✓");
}

function renderProduct(data) {

  product = {
    id: productId,
    ...data
  };

  document.title =
    `${product.name || "المنتج"} - دلوقتي ماركت`;

  productName.textContent =
    product.name || "منتج";

  productPrice.textContent =
    formatPrice(product.price);

  productCategory.textContent =
    getCategory(product);

  if (product.description) {

    productDescription.textContent =
      product.description;

    productDescription.classList.remove("hidden");

  } else {

    productDescription.classList.add("hidden");

  }

  if (product.image) {

    productImage.src = product.image;

    productImage.alt =
      product.name || "صورة المنتج";

  } else {

    productImage.removeAttribute("src");

    productImage.alt = "🛒";

    productImage.style.display = "none";

    const box = productImage.parentElement;

    box.classList.add("no-image");

    box.dataset.icon = "🛒";
  }

  const stock = Number(product.stock);

  if (stock <= 0) {

    addProduct.disabled = true;
    addProduct.textContent = "غير متوفر";

  } else {

    addProduct.disabled = false;
    addProduct.textContent = "🛒 أضف للسلة";

  }

  loading.classList.add("hidden");
  notFound.classList.add("hidden");
  details.classList.remove("hidden");

  setQuantity(1);
}

async function loadProduct() {

  if (!productId) {

    loading.classList.add("hidden");
    notFound.classList.remove("hidden");

    return;
  }

  try {

    const productRef =
      doc(collection(db, "products"), productId);

    const snapshot =
      await getDoc(productRef);

    if (!snapshot.exists()) {

      loading.classList.add("hidden");
      notFound.classList.remove("hidden");

      return;
    }

    const data = snapshot.data();

    if (data.active === false) {

      loading.classList.add("hidden");
      notFound.classList.remove("hidden");

      return;
    }

    renderProduct(data);

  } catch (error) {

    console.error("Product loading error:", error);

    loading.classList.add("hidden");
    notFound.classList.remove("hidden");
  }
}

minusQty.addEventListener("click", () => {

  setQuantity(quantity - 1);

});

plusQty.addEventListener("click", () => {

  setQuantity(quantity + 1);

});

addProduct.addEventListener("click", () => {

  addToCart();

});

updateMiniCart();

loadProduct();
