import {
  db,
  auth,
  esc,
  getRole,
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "./config.js";


const $ = s => document.querySelector(s);


/* =========================
   حالات الطلبات
========================= */

const STATUS = {
  new: "جديد",
  preparing: "قيد التجهيز",
  out: "في الطريق",
  delivered: "تم التسليم",
  cancelled: "ملغي"
};


/* =========================
   الأقسام
========================= */

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


let started = false;


/* =========================
   تسجيل الدخول
========================= */

$("#login").onsubmit = async e => {
  e.preventDefault();

  show("");

  try {
    await signInWithEmailAndPassword(
      auth,
      $("#em").value.trim(),
      $("#pw").value
    );
  } catch (err) {
    show("بيانات الدخول غير صحيحة.");
  }
};


/* =========================
   تسجيل الخروج
========================= */

$("#out").onclick = () => signOut(auth);


/* =========================
   رسالة الخطأ
========================= */

const show = t => {
  $("#err").textContent = t;
  $("#err").classList.toggle("hidden", !t);
};


/* =========================
   متابعة حالة الحساب
========================= */

onAuthStateChanged(auth, async user => {

  const role = await getRole(user);

  const ok = role === "admin";

  $("#login").classList.toggle("hidden", ok);
  $("#app").classList.toggle("hidden", !ok);
  $("#out").classList.toggle("hidden", !user);


  if (user && !ok) {

    show("هذا الحساب لا يملك صلاحية الإدارة.");

    await signOut(auth);

    return;
  }


  if (ok && !started) {

    started = true;

    start();
  }
});


/* =========================
   التبويبات
========================= */

document.querySelector(".tabs").onclick = e => {

  const t = e.target.dataset.t;

  if (!t) return;


  document
    .querySelectorAll(".tabs button")
    .forEach(b => {
      b.classList.toggle("on", b === e.target);
    });


  ["orders", "products", "settings"].forEach(x => {

    $("#" + x).classList.toggle(
      "hidden",
      x !== t
    );

  });
};


/* =========================
   تشغيل لوحة الإدارة
========================= */

function start() {


  /* =====================================================
     الطلبات
  ===================================================== */

  onSnapshot(
    query(
      collection(db, "orders"),
      orderBy("createdAt", "desc")
    ),
    s => {

      if (s.empty) {

        $("#orders").innerHTML =
          "<p>لا توجد طلبات بعد.</p>";

        return;
      }


      $("#orders").innerHTML = s.docs.map(d => {

        const o = d.data();


        /* رابط موقع العميل */
        let locationHtml = "";


        if (o.mapUrl) {

          locationHtml = `
            <div style="margin-top:.5rem">
              <a
                href="${esc(o.mapUrl)}"
                target="_blank"
                rel="noopener"
                class="ghost"
              >
                📍 فتح موقع العميل على الخريطة
              </a>
            </div>
          `;

        } else if (
          o.lat !== undefined &&
          o.lng !== undefined
        ) {

          const mapUrl =
            `https://www.google.com/maps?q=${o.lat},${o.lng}`;


          locationHtml = `
            <div style="margin-top:.5rem">
              <a
                href="${mapUrl}"
                target="_blank"
                rel="noopener"
                class="ghost"
              >
                📍 فتح موقع العميل على الخريطة
              </a>
            </div>
          `;
        }


        return `
          <div
            class="card"
            style="margin-bottom:.6rem"
          >

            <div class="row">

              <strong>
                ${esc(o.name || "")}
                —
                ${esc(o.phone || "")}
              </strong>

              <span
                class="tag ${esc(o.status || "new")}"
              >
                ${STATUS[o.status] || esc(o.status || "جديد")}
              </span>

            </div>


            <div style="margin-top:.4rem">
              ${esc(o.address || "لم يتم تسجيل العنوان")}
            </div>


            ${locationHtml}


            <ul>

              ${(o.items || []).map(i => `
                <li>
                  ${esc(i.name || "")}
                  ×
                  ${Number(i.qty || 0)}
                </li>
              `).join("")}

            </ul>


            <div class="row">

              <span class="price">
                ${Number(o.total || 0)} ج.م
              </span>


              <select data-st="${d.id}">

                ${Object.entries(STATUS).map(
                  ([k, v]) => `
                    <option
                      value="${k}"
                      ${k === o.status ? "selected" : ""}
                    >
                      ${v}
                    </option>
                  `
                ).join("")}

              </select>

            </div>

          </div>
        `;

      }).join("");
    }
  );


  /* =========================
     تغيير حالة الطلب
  ========================= */

  $("#orders").onchange = async e => {

    const id = e.target.dataset.st;

    if (!id) return;


    try {

      await updateDoc(
        doc(db, "orders", id),
        {
          status: e.target.value,
          updatedAt: serverTimestamp()
        }
      );

    } catch (err) {

      alert("حدث خطأ أثناء تحديث حالة الطلب.");

      console.error(err);
    }
  };


  /* =====================================================
     المنتجات
  ===================================================== */

  let prods = [];


  onSnapshot(
    collection(db, "products"),
    s => {

      prods = s.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));


      if (!prods.length) {

        $("#plist").innerHTML =
          "<p>لا توجد منتجات حتى الآن.</p>";

        return;
      }


      $("#plist").innerHTML = prods.map(p => {

        const category =
          p.category || "أخرى";


        const categoryName =
          CATEGORIES[category] || category;


        return `
          <div
            class="card row"
            style="margin-bottom:.4rem"
          >

            <span>

              <strong>
                ${esc(p.name || "")}
              </strong>

              <br>

              <small>
                ${esc(categoryName)}
              </small>

              <br>

              ${Number(p.price || 0)} ج.م

              —

              مخزون
              ${Number(p.stock || 0)}

              ${
                p.active === false
                  ? " — (مخفي)"
                  : ""
              }

            </span>


            <span>

              <button
                class="ghost"
                data-edit="${esc(p.id)}"
              >
                تعديل
              </button>

              <button
                class="bad"
                data-del="${esc(p.id)}"
              >
                حذف
              </button>

            </span>

          </div>
        `;

      }).join("");
    }
  );


  /* =====================================================
     تعديل / حذف المنتجات
  ===================================================== */

  $("#plist").onclick = async e => {

    const ed = e.target.dataset.edit;
    const del = e.target.dataset.del;


    /* تعديل */
    if (ed) {

      const p = prods.find(x => x.id === ed);

      if (!p) return;


      $("#pid").value = p.id;

      $("#pn").value =
        p.name || "";


      $("#pcat").value =
        p.category || "أخرى";


      $("#pp").value =
        p.price ?? "";


      $("#ps").value =
        p.stock ?? "";


      $("#pi").value =
        p.image || "";


      $("#pa").checked =
        p.active !== false;


      /* الانتقال إلى أعلى النموذج */
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      return;
    }


    /* حذف */
    if (del) {

      if (
        !confirm(
          "هل تريد حذف المنتج نهائياً؟"
        )
      ) {
        return;
      }


      try {

        await deleteDoc(
          doc(db, "products", del)
        );

      } catch (err) {

        alert(
          "حدث خطأ أثناء حذف المنتج."
        );

        console.error(err);
      }
    }
  };


  /* =====================================================
     زر منتج جديد
  ===================================================== */

  $("#pc").onclick = () => {

    $("#pf").reset();

    $("#pid").value = "";

    $("#pcat").value = "";

    $("#pa").checked = true;
  };


  /* =====================================================
     حفظ المنتج
  ===================================================== */

  $("#pf").onsubmit = async e => {

    e.preventDefault();


    const name =
      $("#pn").value.trim();


    const category =
      $("#pcat").value.trim();


    const price =
      Number($("#pp").value);


    const stock =
      Number($("#ps").value);


    const image =
      $("#pi").value.trim();


    const active =
      $("#pa").checked;


    /* التأكد من القسم */
    if (!category) {

      alert("من فضلك اختر قسم المنتج.");

      $("#pcat").focus();

      return;
    }


    /* التأكد من السعر */
    if (
      !Number.isFinite(price) ||
      price < 0
    ) {

      alert("السعر غير صحيح.");

      $("#pp").focus();

      return;
    }


    /* التأكد من المخزون */
    if (
      !Number.isFinite(stock) ||
      stock < 0
    ) {

      alert("المخزون غير صحيح.");

      $("#ps").focus();

      return;
    }


    const data = {

      name,

      category,

      price,

      stock,

      image,

      active

    };


    const id =
      $("#pid").value;


    try {

      if (id) {

        /* تعديل منتج */
        await updateDoc(
          doc(db, "products", id),
          data
        );

      } else {

        /* إضافة منتج */
        await addDoc(
          collection(db, "products"),
          {
            ...data,
            createdAt: serverTimestamp()
          }
        );
      }


      /* تنظيف النموذج */
      $("#pf").reset();

      $("#pid").value = "";

      $("#pcat").value = "";

      $("#pa").checked = true;


    } catch (err) {

      console.error(err);

      alert(
        "حدث خطأ أثناء حفظ المنتج."
      );
    }
  };


  /* =====================================================
     الإعدادات
  ===================================================== */

  getDoc(
    doc(db, "settings", "store")
  ).then(s => {

    if (!s.exists()) return;


    const data = s.data();


    $("#wa").value =
      data.whatsapp || "";


    $("#loc").value =
      data.location || "";

  }).catch(err => {

    console.error(
      "خطأ في تحميل إعدادات المحل:",
      err
    );

  });


  /* =====================================================
     حفظ إعدادات المحل
  ===================================================== */

  $("#sf").onsubmit = async e => {

    e.preventDefault();


    const whatsapp =
      $("#wa").value.trim();


    const location =
      $("#loc").value.trim();


    try {

      await setDoc(
        doc(db, "settings", "store"),
        {
          whatsapp,
          location,
          updatedAt: serverTimestamp()
        },
        {
          merge: true
        }
      );


      alert(
        "تم حفظ إعدادات المحل بنجاح."
      );


    } catch (err) {

      console.error(err);

      alert(
        "حدث خطأ أثناء حفظ الإعدادات."
      );
    }
  };

}
