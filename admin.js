import { db, auth, esc, getRole, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "./config.js";

const $ = s => document.querySelector(s);
const STATUS = { new: "جديد", preparing: "قيد التجهيز", out: "في الطريق", delivered: "تم التسليم", cancelled: "ملغي" };
let started = false;

$("#login").onsubmit = async e => {
  e.preventDefault();
  try { await signInWithEmailAndPassword(auth, $("#em").value, $("#pw").value); }
  catch { show("بيانات الدخول غير صحيحة."); }
};
$("#out").onclick = () => signOut(auth);
const show = t => { $("#err").textContent = t; $("#err").classList.toggle("hidden", !t); };

onAuthStateChanged(auth, async user => {
  const role = await getRole(user);
  const ok = role === "admin";
  $("#login").classList.toggle("hidden", ok);
  $("#app").classList.toggle("hidden", !ok);
  $("#out").classList.toggle("hidden", !user);
  if (user && !ok) { show("هذا الحساب لا يملك صلاحية الإدارة."); await signOut(auth); }
  if (ok && !started) { started = true; start(); }
});

document.querySelector(".tabs").onclick = e => {
  const t = e.target.dataset.t; if (!t) return;
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b === e.target));
  ["orders", "products", "settings"].forEach(x => $("#" + x).classList.toggle("hidden", x !== t));
};

function start() {
  // الطلبات
  onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), s => {
    $("#orders").innerHTML = s.empty ? "<p>لا توجد طلبات بعد.</p>" : s.docs.map(d => {
      const o = d.data();
      return `<div class="card" style="margin-bottom:.6rem">
        <div class="row"><strong>${esc(o.name)} — ${esc(o.phone)}</strong><span class="tag ${esc(o.status)}">${STATUS[o.status] || esc(o.status)}</span></div>
        <div>${esc(o.address)}</div>
        <ul>${(o.items || []).map(i => `<li>${esc(i.name)} × ${Number(i.qty)}</li>`).join("")}</ul>
        <div class="row"><span class="price">${Number(o.total)} ج.م</span>
          <select data-st="${d.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${v}</option>`).join("")}</select>
        </div></div>`;
    }).join("");
  });
  $("#orders").onchange = e => {
    const id = e.target.dataset.st; if (id) updateDoc(doc(db, "orders", id), { status: e.target.value, updatedAt: serverTimestamp() });
  };

  // المنتجات
  let prods = [];
  onSnapshot(collection(db, "products"), s => {
    prods = s.docs.map(d => ({ id: d.id, ...d.data() }));
    $("#plist").innerHTML = prods.map(p => `<div class="card row" style="margin-bottom:.4rem">
      <span>${esc(p.name)} — ${Number(p.price)} ج.م — مخزون ${Number(p.stock)} ${p.active === false ? "(مخفي)" : ""}</span>
      <span><button class="ghost" data-edit="${esc(p.id)}">تعديل</button> <button class="bad" data-del="${esc(p.id)}">حذف</button></span></div>`).join("");
  });
  $("#plist").onclick = async e => {
    const ed = e.target.dataset.edit, del = e.target.dataset.del;
    if (ed) { const p = prods.find(x => x.id === ed);
      $("#pid").value = p.id; $("#pn").value = p.name; $("#pp").value = p.price; $("#ps").value = p.stock;
      $("#pi").value = p.image || ""; $("#pa").checked = p.active !== false; scrollTo(0, 0); }
    if (del && confirm("حذف المنتج نهائياً؟")) await deleteDoc(doc(db, "products", del));
  };
  $("#pc").onclick = () => $("#pf").reset() || ($("#pid").value = "");
  $("#pf").onsubmit = async e => {
    e.preventDefault();
    const data = { name: $("#pn").value.trim(), price: Number($("#pp").value), stock: Number($("#ps").value),
      image: $("#pi").value.trim(), active: $("#pa").checked };
    const id = $("#pid").value;
    if (id) await updateDoc(doc(db, "products", id), data); else await addDoc(collection(db, "products"), data);
    $("#pf").reset(); $("#pid").value = "";
  };

  // الإعدادات
  getDoc(doc(db, "settings", "store")).then(s => { if (s.exists()) { $("#wa").value = s.data().whatsapp || ""; $("#loc").value = s.data().location || ""; } });
  $("#sf").onsubmit = async e => {
    e.preventDefault();
    await setDoc(doc(db, "settings", "store"), { whatsapp: $("#wa").value.trim(), location: $("#loc").value.trim() });
    alert("تم حفظ الإعدادات");
  };
}
