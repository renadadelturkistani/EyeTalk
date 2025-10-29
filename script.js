/* =========================================================
   [FIREBASE LOGIC]  إعداد وربط النظام
   ---------------------------------------------------------
   هذا القسم خاص بتهيئة Firebase. 
   ملاحظة: نظام التسجيل وتسجيل الدخول يستخدم Firestore.
   بينما نظام الطوارئ في الواجهة يستخدم Realtime Database.
   تم توحيد الإعداد بحيث يمكن استدعاؤه مرة واحدة.
========================================================= */

/* =========================================================
   [FIREBASE LOGIC]  إعداد وربط النظام
========================================================= */


const firebaseConfig = {
  apiKey: "AIzaSyCBGtwVSod4bZ13hH7ZJLAOW0xPbKmzJEw",
  authDomain: "eyetalk-96125.firebaseapp.com",
  projectId: "eyetalk-96125",
  storageBucket: "eyetalk-96125.appspot.com",
  messagingSenderId: "663319806538",
  appId: "1:663319806538:web:e93e47829d0cb4eba4dcb3"
};

// ✅ تأكدي أن التهيئة تتم مرة واحدة فقط
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} else {
  console.log("Firebase already initialized");
}

// ✅ تعريف الخدمات المطلوبة
const db = firebase.database();
const firestore = firebase.firestore();
const auth = firebase.auth();




/* =========================================================
   [EMAILJS LOGIC]  إعداد وإرسال الإيميلات
   ---------------------------------------------------------
   هذا القسم خاص بتهيئة مفاتيح EmailJS.
   نفس المفاتيح تُستخدم في صفحة التسجيل وفي صفحة الواجهة.
========================================================= */

const EMAILJS_SERVICE_ID  = "service_efegnl1";        
const TEMPLATE_WELCOME_ID = "template_8vngicw";       
const TEMPLATE_ALERT_ID   = "template_3xh21gb";       
const EMAILJS_PUBLIC_KEY  = "DX_7hfu4mvcCyCf9B";      

try {
  if (window.emailjs && emailjs.init) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log("EmailJS initialized successfully");
  }
} catch (e) {
  console.warn("EmailJS init error:", e);
}


/* =========================================================
   [REGISTER PAGE LOGIC]  إنشاء حساب جديد
   ---------------------------------------------------------
   هذا القسم يُفعّل تلقائيًا فقط إذا وُجد form#registerForm.
   يقوم بإنشاء الحساب في Firebase Authentication،
   ثم يحفظ بيانات المستخدم في Firestore،
   ويرسل رسالة ترحيب عبر EmailJS،
   وبعدها يحول المستخدم إلى صفحة تسجيل الدخول (index.html).
========================================================= */

if (document.getElementById("registerForm")) {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fullName       = document.getElementById("fullName").value.trim();
    const assistantName  = document.getElementById("assistantName").value.trim();
    const assistantEmail = document.getElementById("assistantEmail").value.trim();
    const password       = document.getElementById("regPassword").value;

    try {
      // إنشاء الحساب في Firebase Authentication
      const { user } = await auth.createUserWithEmailAndPassword(assistantEmail, password);
      console.log("تم إنشاء الحساب بنجاح:", user.uid);

      // حفظ البيانات في Firestore
      await firestore.collection("patients").doc(user.uid).set({
        fullName,
        assistantName,
        assistantEmail,
        createdAt: new Date().toISOString()
      });

      // إرسال رسالة الترحيب عبر EmailJS
      try {
        const params = {
          assistant_name: assistantName,
          email: assistantEmail,
          date: new Date().toLocaleString()
        };
        await emailjs.send(EMAILJS_SERVICE_ID, TEMPLATE_WELCOME_ID, params);
        console.log("تم إرسال رسالة الترحيب بنجاح");
      } catch (mailErr) {
        console.warn("تعذر إرسال رسالة الترحيب:", mailErr);
      }

      // حفظ البيانات محليًا
      localStorage.setItem("patientName", fullName);
      localStorage.setItem("assistantName", assistantName);
      localStorage.setItem("assistantEmail", assistantEmail);

      // تنبيه المستخدم وتحويله إلى صفحة تسجيل الدخول
      alert("تم إنشاء الحساب وإرسال رسالة الترحيب بنجاح!");
      window.location.href = "index.html";

    } catch (error) {
      console.error("حدث خطأ أثناء إنشاء الحساب:", error);
      alert("حدث خطأ: " + (error?.message || error));
    }
  });
}



/* =========================================================
   [LOGIN PAGE LOGIC]  تسجيل دخول المساعد
   ---------------------------------------------------------
   هذا القسم يُفعّل تلقائيًا فقط إذا وُجد form#loginForm.
   يقوم بالتحقق من بيانات تسجيل الدخول من Firebase Auth،
   ثم جلب بيانات المستخدم من Firestore وحفظها محليًا،
   وأخيرًا تحويل المستخدم إلى الصفحة الرئيسية (home.html).
========================================================= */

if (document.getElementById("loginForm")) {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email    = document.getElementById("assistantEmail").value.trim();
    const password = document.getElementById("password").value;

    try {
      // تسجيل الدخول باستخدام Firebase Auth
      const { user } = await firebase.auth().signInWithEmailAndPassword(email, password);
      console.log("تم تسجيل الدخول:", user.uid);

      // محاولة جلب بيانات المستخدم من Firestore
      let patientName   = "المريض";
      let assistantName = "المساعد";
      let assistantEmail= email;

      try {
        const ref  = firebase.firestore().collection("patients").doc(user.uid);
        const snap = await ref.get();

        if (snap.exists) {
          const data = snap.data();
          patientName    = data.fullName       || patientName;
          assistantName  = data.assistantName  || assistantName;
          assistantEmail = data.assistantEmail || assistantEmail;
          console.log("تم جلب بيانات Firestore بنجاح");
        } else {
          console.log("لم يتم العثور على وثيقة للمستخدم");
        }
      } catch (fireErr) {
        console.warn("خطأ أثناء قراءة Firestore:", fireErr);
      }

      // حفظ البيانات محليًا
      localStorage.setItem("patientName",   patientName);
      localStorage.setItem("assistantName", assistantName);
      localStorage.setItem("assistantEmail",assistantEmail);

      // الانتقال إلى صفحة home.html بعد نجاح تسجيل الدخول
      window.location.href = "home.html";

    } catch (error) {
      console.error("فشل تسجيل الدخول:", error);
      alert("فشل تسجيل الدخول: " + (error?.message || error));
    }
  });
}




/* =========================================================
   [EMAILJS - WELCOME FUNCTION]
   ---------------------------------------------------------
   هذه الدالة كانت موجودة مسبقاً في صفحة register.html.
   يتم استدعاؤها بعد إنشاء حساب جديد لإرسال رسالة ترحيب.
   حالياً غير مستخدمة هنا، لكنها تُترك للمرجعية.
========================================================= */

// function sendWelcomeEmail(userName, userEmail, date) {
//   const templateParams = { user_name: userName, email: userEmail, date: date };
//   emailjs.send(EMAILJS_SERVICE_ID, TEMPLATE_WELCOME_ID, templateParams)
//     .then(() => console.log("Welcome email sent successfully"))
//     .catch((error) => console.error("Error sending welcome email:", error));
// }

/* =========================================================
   [EYE TALK SYSTEM SCRIPT]  النسخة المنظمة الكاملة
   ---------------------------------------------------------
   هذا السكربت مسؤول عن الصفحة الرئيسية (home.html)
   ويتضمن منطق النطق، التتبع البصري، الطوارئ، التوقف،
   والاستئناف، وإرسال البريد باستخدام EmailJS.
========================================================= */

/* =========================================================
   1. إعداد النظام العام والصوت
========================================================= */

// const alarm = new Audio("alarm.mp3");
// alarm.loop = true;

// حالات النظام
let isPaused = false;             // عند true → تتبع النظر موقوف
let isEmergencyActive = false;    // عند true → النظام في حالة طوارئ
let lastFocusedIcon = null;       // آخر أيقونة ركز عليها المستخدم
let focusStartTime = null;        // لحساب مدة الثبات بالنظر
const focusDuration = 1000;       // مدة التركيز المطلوبة (1 ثانية)
let isSilent = false;             // ✅ لو true النظام ما ينطق (كتم الصوت)

// عناصر الواجهة
const cursorDot = document.getElementById("cursorDot");
const container = document.getElementById("iconsContainer");
const stopBtn   = document.getElementById("stopAlarm");
const stopTrackingIcon  = document.getElementById("stopTracking");
const startTrackingIcon = document.getElementById("startTracking");



/* =========================================================
   3. نظام الطوارئ الكامل
========================================================= */

function triggerEmergency() {
  if (isEmergencyActive) return;
  isEmergencyActive = true;

  // مهم: خَل isPaused = false علشان التتبع يظل شغال
  // لكن بنقيّد السلوك داخل OnResult بناءً على isEmergencyActive
  isPaused = false;

  speak("حالة طارئة");

  // اذا كنت تستخدم إنذار صوتي حقيقي:
  // try { alarm.play(); } catch (_) {}

  if (stopBtn) stopBtn.style.display = "block";

  // خلي كل الأيقونات تبين "حالة طوارئ" بشكل بصري
  dimAllIconsExceptStop();

  showEmergencyNotification();
  sendEmergencyEmail().finally(saveEmergencyToFirebase);
}

function stopEmergency() {
  // try { alarm.pause(); alarm.currentTime = 0; } catch (_) {}

  isEmergencyActive = false;
  isPaused = false; // رجع التفاعل طبيعي

  if (stopBtn) stopBtn.style.display = "none";

  restoreIconsNormal();

  speak("تم إلغاء حالة الطوارئ");
}


/* ---------------------------------------------------------
   إرسال البريد للطوارئ
--------------------------------------------------------- */
function sendEmergencyEmail() {
  try {
    const assistantEmail = localStorage.getItem("assistantEmail") || "";
    const assistantName  = localStorage.getItem("assistantName")  || "";
    const patientName    = localStorage.getItem("patientName")    || "مستخدم مجهول";
    if (!assistantEmail) return;

    const params = {
      assistant_name: assistantName,
      patient_name: patientName,
      email: assistantEmail,
      time: new Date().toLocaleString()
    };

    return emailjs.send(EMAILJS_SERVICE_ID, TEMPLATE_ALERT_ID, params)
      .then(() => console.log("Emergency email sent"))
      .catch((err) => console.error("Email error:", err));
  } catch (e) {
    console.warn("EmailJS send error:", e);
  }
}

/* ---------------------------------------------------------
   حفظ بيانات الطوارئ في Firebase
--------------------------------------------------------- */
function saveEmergencyToFirebase() {
  if (!db) return;
  try {
    const patientName = localStorage.getItem("patientName") || "مستخدم مجهول";
    db.ref("emergencies").push({
      patient: patientName,
      time: new Date().toISOString()
    });
  } catch (e) {
    console.warn("Firebase write error:", e);
  }
}

/* ---------------------------------------------------------
   إشعار النظام على سطح المكتب
--------------------------------------------------------- */
function showEmergencyNotification() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("حالة طارئة", { body: "تم إرسال إشعار للمساعد." });
  } else {
    Notification.requestPermission().then(p => {
      if (p === "granted") showEmergencyNotification();
    });
  }
}

/* =========================================================
   4. إنشاء الأيقونات الأساسية في الصفحة
========================================================= */
function buildIcons() {
  if (!container) return;

  const defaults = [
    { emoji: "🍽️", label: "أريد الطعام" },
    { emoji: "💧",  label: "أريد الماء" },
    { emoji: "🚻",  label: "أريد الحمام" },
    { emoji: "🚶‍♀️", label: "أريد المشي" },
    { emoji: "💊",  label: "أريد الدواء" },
    { emoji: "🚨",  label: "حالة طارئة", action: "emergency" }
  ];

  // نستخدم المحفوظة أو الافتراضية
  const saved = JSON.parse(localStorage.getItem("customIcons") || "null") || defaults;
  container.innerHTML = "";

  saved.forEach(item => {
    // التحقق الذكي: سواء action أو الإيموجي أو النص
    const isEmergency =
      item.action === "emergency" ||
      item.emoji === "🚨" ||
      /طارئة|طوارئ/.test(item.label);

    const div = document.createElement("div");
    div.className = isEmergency ? "icon emergency" : "icon";
    div.dataset.speech = item.label;
    div.dataset.action = isEmergency ? "emergency" : "";
  div.innerHTML = `
  <svg class="focus-ring"><circle cx="100" cy="100" r="90"></circle></svg>
  <div class="icon-emoji">${item.emoji}</div>
  <div class="icon-label">${item.label}</div>
`;

    container.appendChild(div);
  });
}


// ننتظر تحميل الصفحة أولاً قبل إنشاء الأيقونات
window.addEventListener("DOMContentLoaded", buildIcons);




/* =========================================================
   6. منطق التتبع بالنظر (Gaze Tracking Logic)
   ---------------------------------------------------------
   هذا القسم يستخدم GazeCloudAPI لتحديد الأيقونة التي
   ينظر إليها المستخدم، ويتفاعل معها وفقاً للحالة الحالية.
========================================================= */
GazeCloudAPI.OnResult = function (GazeData) {
  if (GazeData.state !== 0 || isPaused) return;

  const x = GazeData.docX;
  const y = GazeData.docY;

  // 🔵 حركة المؤشر
  cursorDot.style.left = `${x}px`;
  cursorDot.style.top = `${y}px`;

  // 🔵 العنصر الذي يتم النظر إليه
const element = document.elementFromPoint(x, y)?.closest(".icon, .side-icon");

  // ✅ أولاً: التحقق من أيقونات الصوت الجانبية
  if (element && element.classList.contains("side-icon")) {
    const action = element.dataset.action;

    if (action === "mute") {
      isSilent = true;
      speak("تم كتم الصوت");
    } else if (action === "unmute") {
      isSilent = false;
      speak("تم تشغيل الصوت");
    }

    return; // نوقف هنا حتى لا يدخل في منطق الأيقونات العادية
  }

  // ✅ ثانياً: منطق الأيقونات الأساسية (الطعام، الماء، الطوارئ... إلخ)
  if (element && element.classList.contains("icon")) {
    if (element !== lastFocusedIcon) {
      lastFocusedIcon = element;
      focusStartTime = Date.now();
    } else {
      if (Date.now() - focusStartTime >= focusDuration && !element.classList.contains("active")) {
        document.querySelectorAll(".icon").forEach(el => el.classList.remove("active"));
        element.classList.add("active");

        const text = element.dataset.speech;
        const action = element.dataset.action;

        if (action === "emergency" || text?.includes("🚨")) {
          triggerEmergency();
        } else if (text && !isSilent) {
          speak(text);
        }
      }
    }
  } else {
    lastFocusedIcon = null;
    focusStartTime = null;
    document.querySelectorAll(".icon").forEach(el => el.classList.remove("active"));
  }
};

// ✅ بدء التتبع تلقائي عند تحميل الصفحة
window.addEventListener("load", () => {
  try {
    GazeCloudAPI.StartEyeTracking();
    console.log("✅ تم تشغيل تتبع النظر بنجاح");
  } catch (e) {
    console.error("❌ خطأ أثناء تشغيل التتبع:", e);
  }
});





/* ---------------------------------------------------------
   دالة لتنظيف النص من الإيموجي أو الأكواد
--------------------------------------------------------- */
function sanitizeText(text) {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/<[^>]*>/g, "");
  try {
    t = t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
  } catch (_) {
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  }
  return t.replace(/\s+/g, " ").trim();
}


/* =========================================================
   8. دالة التنقيح (Debug Helper)
========================================================= */
function debug(msg) {
  console.log(msg);
  const el = document.getElementById("debug");
  if (el) el.textContent = typeof msg === "string" ? msg : (msg?.message || JSON.stringify(msg));
}
/* =========================================================
   [SIDEBAR LOGIC]  منطق فتح وإغلاق القائمة الجانبية
   ---------------------------------------------------------
   هذا القسم يفعّل الزر ☰ لفتح القائمة الجانبية وإغلاقها
   ويعمل في جميع الصفحات التي تحتوي على عناصر:
   #menuToggle, #sidebar, #overlay
========================================================= */


document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      overlay.classList.toggle("show");
    });

    overlay.addEventListener("click", () => {
      sidebar.classList.remove("active");
      overlay.classList.remove("show");
    });
  }
});




// ✅ عند الضغط على زر "إيقاف الطوارئ"
document.addEventListener("DOMContentLoaded", () => {
  const stopBtn = document.getElementById("stopAlarm");
  if (stopBtn) {
    stopBtn.addEventListener("click", () => {
      stopEmergency(); // ← يستدعي الدالة اللي عندك فوق
    });
  }
});




function speak(text) {
  if (!text) return;

  // إنشاء كائن الصوت
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ar-SA"; // ✅ صوت عربي سعودي
  utterance.rate = 1;
  utterance.pitch = 1;
  speechSynthesis.cancel(); // يوقف أي كلام سابق
  speechSynthesis.speak(utterance);
}
