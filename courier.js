import { db, auth, esc, getRole, collection, doc, updateDoc, onSnapshot, query, where, orderBy,
  serverTimestamp, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "./config.js";

const $ = s => document.querySelector(s);
const STATUS = { new: "جديد", preparing: "قيد التجهيز", out: "في الطريق" };
const NEXT = { new: ["preparing", "ابدأ التجهيز"], preparing: ["out", "خرجت للتوصيل"], out: ["delivered", "تم التسليم"] };
let unsub = null;
const show = t => { $("#err").textContent = t; $("#err").classList.toggle("hidden", !t); };

$("#login").onsubmit = async e => {
  e.preventDefault();
  try { await signInWithEmailAndPassword(auth, $("#em").value, $("#pw").value); }
  catch { show("بيانات الدخول غير صحيحة."); }
};
$("#out").onclick = () => signOut(auth);

onAuthStateChanged(auth, async user => {
  const role = await getRole(user);
  const ok = role === "courier";
  $("#login").classList.toggle("hidden", ok);
  $("#list").classList.toggle("hidden", !ok);
  $("#out").classList.toggle("hidden", !user);
  if (unsub) { unsub(); unsub = null; }
  if (user && !ok) { show("هذا الحساب ليس حساب مندوب."); await signOut(auth); }
  if (!ok) return;
  const q = query(collection(db, "orders"), where("status", "in", ["new", "preparing", "out"]), orderBy("createdAt", "desc"));
  unsub = onSnapshot(q, s => {
    $("#list").innerHTML = s.empty ? "<p>لا توجد طلبات حالياً.</p>" : s.docs.map(d => {
      const o = d.data(), n = NEXT[o.status];
      return `<div class="card" style="margin-bottom:.6rem">
        <div class="row"><strong>${esc(o.name)}</strong><span class="tag ${esc(o.status)}">${STATUS[o.status]}</span></div>
        <div><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div>
        <div>${esc(o.address)}</div>
        <ul>${(o.items || []).map(i => `<li>${esc(i.name)} × ${Number(i.qty)}</li>`).join("")}</ul>
        <div class="row"><span class="price">${Number(o.total)} ج.م</span>
        <button class="sun" data-id="${d.id}" data-next="${n[0]}">${n[1]}</button></div></div>`;
    }).join("");
  }, () => { $("#list").innerHTML = "<p class='msg err'>تعذر تحميل الطلبات. قد يلزم إنشاء فهرس في Firestore (افتح رابط الخطأ في Console).</p>"; });
});

$("#list").onclick = e => {
  const id = e.target.dataset.id; if (!id) return;
  updateDoc(doc(db, "orders", id), { status: e.target.dataset.next, courierId: auth.currentUser.uid, updatedAt: serverTimestamp() });
};
