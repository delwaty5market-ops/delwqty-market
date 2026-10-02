import { db, esc, collection, addDoc, onSnapshot, doc, serverTimestamp } from "./config.js";

const $ = s => document.querySelector(s);
let products = [], cart = {};
try { cart = JSON.parse(localStorage.getItem("cart") || "{}"); } catch { cart = {}; }

onSnapshot(collection(db, "products"), s => {
  products = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active !== false);
  renderList(); renderCart();
});
onSnapshot(doc(db, "settings", "store"), s => {
  const n = s.exists() && s.data().whatsapp;
  if (n) { $("#wa").href = "https://wa.me/" + String(n).replace(/\D/g, ""); $("#wa").classList.remove("hidden"); }
});

const save = () => localStorage.setItem("cart", JSON.stringify(cart));
const fmt = n => Number(n).toLocaleString("ar-EG") + " ج.م";

function renderList() {
  const q = $("#q").value.trim();
  const items = products.filter(p => !q || String(p.name).includes(q));
  $("#empty").classList.toggle("hidden", items.length > 0);
  $("#list").innerHTML = items.map(p => {
    const out = Number(p.stock) <= 0;
    return `<div class="card">
      ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : `<img alt="">`}
      <div>${esc(p.name)}</div><div class="price">${fmt(p.price)}</div>
      <button class="sun" data-add="${esc(p.id)}" ${out ? "disabled" : ""} style="width:100%;margin-top:.4rem">${out ? "نفد" : "أضف للسلة"}</button>
    </div>`;
  }).join("");
}
$("#q").oninput = renderList;
$("#list").onclick = e => {
  const id = e.target.dataset.add; if (!id) return;
  const p = products.find(x => x.id === id);
  if ((cart[id] || 0) < Number(p.stock)) cart[id] = (cart[id] || 0) + 1;
  save(); renderCart();
};

function lines() {
  return Object.entries(cart).map(([id, qty]) => {
    const p = products.find(x => x.id === id); return p ? { id, name: p.name, price: Number(p.price), qty } : null;
  }).filter(Boolean);
}
function renderCart() {
  const ls = lines(), total = ls.reduce((a, l) => a + l.price * l.qty, 0);
  $("#cart").classList.toggle("hidden", ls.length === 0);
  $("#sum").textContent = `${ls.reduce((a, l) => a + l.qty, 0)} منتج — ${fmt(total)}`;
  $("#lines").innerHTML = ls.map(l => `<div class="row"><span>${esc(l.name)}</span>
    <span><button class="ghost" data-dec="${esc(l.id)}">−</button> ${l.qty}
    <button class="ghost" data-inc="${esc(l.id)}">+</button></span></div>`).join("");
}
$("#toggle").onclick = () => {
  const d = $("#detail"); d.classList.toggle("hidden");
  $("#toggle").textContent = d.classList.contains("hidden") ? "عرض السلة" : "إخفاء";
};
$("#lines").onclick = e => {
  const inc = e.target.dataset.inc, dec = e.target.dataset.dec, id = inc || dec; if (!id) return;
  const p = products.find(x => x.id === id);
  cart[id] = (cart[id] || 0) + (inc ? 1 : -1);
  if (cart[id] <= 0) delete cart[id];
  if (p && cart[id] > Number(p.stock)) cart[id] = Number(p.stock);
  save(); renderCart();
};

function say(t, err) { const s = $("#status"); s.textContent = t; s.className = "msg" + (err ? " err" : ""); }
$("#send").onclick = async () => {
  const ls = lines(), name = $("#name").value.trim(), phone = $("#phone").value.trim(), address = $("#addr").value.trim();
  if (!ls.length) return say("السلة فارغة.", true);
  if (!name || phone.length < 8 || !address) return say("اكتب الاسم ورقم الموبايل والعنوان.", true);
  $("#send").disabled = true;
  try {
    await addDoc(collection(db, "orders"), {
      name, phone, address, items: ls,
      total: ls.reduce((a, l) => a + l.price * l.qty, 0),
      status: "new", createdAt: serverTimestamp()
    });
    cart = {}; save(); renderCart();
    say("تم استلام طلبك، هنتواصل معاك قريب.");
  } catch (e) { say("تعذر إرسال الطلب، حاول مرة أخرى.", true); }
  $("#send").disabled = false;
};
