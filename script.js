/* =========================================================
   🗣️ النطق (Text-To-Speech) — يقرأ النص فقط بدون الإيموجي
========================================================= */
function sanitizeText(text) {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/<[^>]*>/g, ""); // إزالة HTML
  try {
    t = t.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "");
  } catch (_) {
    t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  }
  return t.replace(/\s+/g, " ").trim();
}
function speak(text) {
  const onlyText = sanitizeText(text);
  if (!onlyText) return;
  try {
    const msg = new SpeechSynthesisUtterance(onlyText);
    msg.lang = "ar-SA";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  } catch (e) { console.warn("Speech error:", e); }
}

/* =========================================================
   🔥 Firebase — (اختياري) عدّل الإعدادات واربط SDK في HTML
========================================================= */
const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
let db = null;
try {
  if (window.firebase && firebase.initializeApp && firebase.database) {
    const app = firebase.initializeApp(firebaseConfig);
    db = firebase.database(app);
  }
} catch (e) { console.warn("Firebase init error:", e); }

/* =========================================================
   ✉️ EmailJS — (اختياري) غيّر IDs + المفتاح العام واربط SDK
========================================================= */
const EMAILJS_SERVICE_ID  = "service_b5uzkwh";      // غيّره
const EMAILJS_TEMPLATE_ID = "template_hmqnbok";     // غيّره
const EMAILJS_PUBLIC_KEY  = "YOUR_PUBLIC_KEY_HERE"; // غيّره
try {
  if (window.emailjs && emailjs.init) emailjs.init(EMAILJS_PUBLIC_KEY);
} catch (e) { console.warn("EmailJS init error:", e); }

/* =========================================================
   🚨 الطوارئ — صوت + إشعار + إيميل + حفظ في Firebase
========================================================= */
const alarm = new Audio("alarm.mp3");
alarm.loop = true;

let pauseTracking   = false;   // لإيقاف/تشغيل تتبع النظر
let lastFocusedIcon = null;    // آخر أيقونة عليها تركيز
let focusStartTime  = null;    // وقت بدء التركيز
const focusDuration = 800;     // ms — مدة الوقوف لتنفيذ الحدث

const cursorDot = document.getElementById("cursorDot");
const container = document.getElementById("iconsContainer");
const stopBtn   = document.getElementById("stopAlarm");

if (stopBtn) stopBtn.onclick = stopEmergency;

function stopEmergency() {
  try { alarm.pause(); alarm.currentTime = 0; } catch (_) {}
  if (stopBtn) stopBtn.style.display = "none";
  pauseTracking = false;
  speak("تم إلغاء حالة الطوارئ");
}
function showEmergencyNotification() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification("حالة طارئة", { body: "المستخدم بحاجة إلى مساعدة!" });
  } else {
    Notification.requestPermission().then(p => { if (p === "granted") showEmergencyNotification(); });
  }
}
function sendEmergencyEmail() {
  try {
    if (!window.emailjs) return;
    const assistantEmail = localStorage.getItem("assistantEmail") || "";
    const assistantName  = localStorage.getItem("assistantName")  || "";
    const patientName    = localStorage.getItem("patientName")    || "";
    if (!assistantEmail) return;
    return emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      { assistantName, name: patientName, email: assistantEmail },
      EMAILJS_PUBLIC_KEY
    );
  } catch (e) { console.warn("EmailJS send error:", e); }
}
function saveEmergencyToFirebase() {
  if (!db) return;
  try {
    const patientName = localStorage.getItem("patientName") || "مستخدم مجهول";
    db.ref("emergencies").push({ patient: patientName, time: new Date().toISOString() });
  } catch (e) { console.warn("Firebase write error:", e); }
}
function triggerEmergency() {
  try { alarm.play(); } catch (_) {}
  pauseTracking = true;
  if (stopBtn) stopBtn.style.display = "block";
  speak("حالة طارئة");
  showEmergencyNotification();
  Promise.resolve(sendEmergencyEmail()).catch(()=>{}).finally(saveEmergencyToFirebase);
}

/* =========================================================
   👁️ بناء شبكة الأيقونات (من localStorage)
========================================================= */
(function buildIcons() {
  if (!container) return;
  const defaults = [
    { emoji: "🍽️", label: "أريد الطعام" },
    { emoji: "💧",  label: "أريد الماء" },
    { emoji: "🚨",  label: "حالة طارئة" },
    { emoji: "🚻",  label: "أريد الحمام" },
    { emoji: "🚶‍♀️", label: "أريد المشي" },
    { emoji: "💊",  label: "أريد الدواء" }
  ];
  const saved = JSON.parse(localStorage.getItem("customIcons") || "null") || defaults;
  container.innerHTML = "";
  saved.forEach(item => {
    const isEmergency = item.emoji === "🚨" || /طارئة|طوارئ/.test(item.label);
    const div = document.createElement("div");
    div.className = isEmergency ? "icon emergency" : "icon";
    div.dataset.speech = item.label;                     // النطق يقرأ هذا فقط
    div.dataset.action = isEmergency ? "emergency" : ""; // تمييز الطوارئ
    div.innerHTML = `<div class="icon-emoji">${item.emoji}</div><div class="icon-label">${item.label}</div>`;
    container.appendChild(div);
  });
})();

/* =========================================================
   👀 GazeCloud — تتبع النظر وتنفيذ الأوامر عند الثبات
========================================================= */
if (window.GazeCloudAPI) {
  GazeCloudAPI.OnResult = function (GazeData) {
    if (GazeData.state !== 0 || pauseTracking) return;
    const x = GazeData.docX, y = GazeData.docY;

    // حرّك مؤشر النظر الأحمر (لو موجود)
    if (cursorDot) { cursorDot.style.left = `${x}px`; cursorDot.style.top  = `${y}px`; }

    // اعرف العنصر الحالي
    const el = document.elementFromPoint(x, y);
    const icon = el?.closest ? el.closest(".icon") : (el && el.classList && el.classList.contains("icon") ? el : null);

    if (icon) {
      if (icon !== lastFocusedIcon) { lastFocusedIcon = icon; focusStartTime = Date.now(); }
      else {
        const stayed = Date.now() - focusStartTime >= focusDuration;
        if (stayed && !icon.classList.contains("active")) {
          document.querySelectorAll(".icon").forEach(i => i.classList.remove("active"));
          icon.classList.add("active");
          const act  = icon.dataset.action;
          const text = icon.dataset.speech;
          if (act === "emergency") triggerEmergency();
          else if (text) speak(text);
        }
      }
    } else {
      lastFocusedIcon = null;
      focusStartTime  = null;
      document.querySelectorAll(".icon").forEach(i => i.classList.remove("active"));
    }
  };

  // بدء التتبع
  try { GazeCloudAPI.StartEyeTracking(); } catch (_) {}

  // استعادة/حفظ المعايرة
  const savedCalibration = localStorage.getItem("gazeCalibration");
  if (savedCalibration) { try { GazeCloudAPI.SetCalibration(JSON.parse(savedCalibration)); } catch (_) {} }
  GazeCloudAPI.OnCalibrationComplete = data => {
    try { localStorage.setItem("gazeCalibration", JSON.stringify(data)); } catch (_) {}
  };
}

/* =========================================================
   🧭 السايدبار + تفضيلات المظهر (ثيم/حجم خط)
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  // سايدبار للجوال
  const menuToggle = document.getElementById("menuToggle") || document.querySelector(".menu-toggle");
  const sidebar    = document.getElementById("sidebar");
  const overlay    = document.getElementById("overlay");

  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener("click", () => { sidebar.classList.add("active"); overlay.classList.add("active"); });
    overlay.addEventListener("click", () => { sidebar.classList.remove("active"); overlay.classList.remove("active"); });
    document.getElementById('closeSidebar')?.addEventListener('click', () => {
      sidebar.classList.remove('active'); overlay.classList.remove('active');
    });
  }

  // وضع الهدوء (إيقاف/تشغيل تتبع النظر)
  const btnSleep = document.getElementById("sb-sleep");
  const btnWake  = document.getElementById("sb-wake");
  if (btnSleep && btnWake) {
    btnSleep.addEventListener("click", () => {
      pauseTracking = true;
      btnSleep.style.display = "none";
      btnWake.style.display  = "block";
      sidebar?.classList.remove("active"); overlay?.classList.remove("active");
    });
    btnWake.addEventListener("click", () => {
      pauseTracking = false;
      btnWake.style.display  = "none";
      btnSleep.style.display = "block";
      sidebar?.classList.remove("active"); overlay?.classList.remove("active");
    });
  }

  // تطبيق الثيم/الخط من التخزين (متوافق مع صفحة الإعدادات)
  try {
    const cls  = localStorage.getItem('app_theme_cls') || 'theme-dark';
    document.body.classList.remove('theme-dark','theme-light');
    document.body.classList.add(cls);

    const pct  = +localStorage.getItem('app_font_pct') || 100;
    document.documentElement.style.setProperty('--base-font', pct + '%');
  } catch (_) {}
});

/* =========================================================
   🧩 صفحة الإعدادات — عناصرها اختيارية، نربطها لو موجودة
========================================================= */
(function wireSettingsPage(){
  const darkToggle = document.getElementById('darkModeToggle');
  const darkLabel  = document.getElementById('darkLabel');
  const range      = document.getElementById('fontSizeRange');
  const fontValue  = document.getElementById('fontValue');

  // ثيم
  const themeKey = 'app_theme_cls';
  function applyThemeCls(cls){
    document.body.classList.remove('theme-dark','theme-light');
    document.body.classList.add(cls);
    localStorage.setItem(themeKey, cls);
    if (darkToggle) darkToggle.checked = (cls === 'theme-dark');
    if (darkLabel)  darkLabel.textContent = (cls === 'theme-dark' ? 'On' : 'Off');
  }
  const savedTheme = localStorage.getItem(themeKey) || 'theme-dark';
  applyThemeCls(savedTheme);
  darkToggle?.addEventListener('change', e => applyThemeCls(e.target.checked ? 'theme-dark' : 'theme-light'));

  // حجم الخط
  const fontKey = 'app_font_pct';
  function applyFont(pct){
    const n = Math.max(85, Math.min(125, Number(pct)));
    document.documentElement.style.setProperty('--base-font', n + '%');
    localStorage.setItem(fontKey, n);
    if (fontValue) fontValue.textContent = n + '%';
  }
  const savedFont = localStorage.getItem(fontKey) || 100;
  applyFont(savedFont);
  if (range){ range.value = savedFont; range.addEventListener('input', e => applyFont(e.target.value)); }
})();

/* =========================================================
   👥 الروابط حسب الدور (مريض/مساعد) — للسايدبار
========================================================= */
(function buildSideLinks() {
  const el = document.getElementById('sideLinks');
  if (!el) return;
  const userRole = localStorage.getItem('role') || 'patient'; // 'patient' | 'assistant'
  const patient = [
    { href:'home.html', label:'الرئيسية' },
    { href:'exercises.html', label:'التمارين' },
    { href:'profile.html', label:'الملف الشخصي' },
    { href:'settings.html', label:'الإعدادات' },
  ];
  const assistant = [
    { href:'dashboard.html', label:'لوحة التحكم' },
    { href:'reports.html', label:'التقارير' },
    { href:'users.html', label:'المستخدمون' },
    { href:'settings.html', label:'الإعدادات' },
  ];
  (userRole === 'assistant' ? assistant : patient).forEach(l => {
    const a = document.createElement('a');
    a.href = l.href; a.textContent = l.label;
    el.appendChild(a);
  });
})();
/* =======================
   صفحة الملف الشخصي
======================= */
(function profilePage(){
  // ما نشتغل إلا لو الصفحة فيها عناصر الملف الشخصي
  const nameEl = document.getElementById('uName');
  const emailEl= document.getElementById('uEmail');
  const phoneEl= document.getElementById('uPhone');
  const form   = document.getElementById('pwdForm');

  if (!nameEl || !emailEl || !phoneEl || !form) return;

  // ---- قراءة بيانات المستخدم من التخزين المحلي (Demo)
  // المفتاح المقترح: user_profile = { name,email,phone,password }
  // لو عندك صفحة تسجيل، تأكد إنها تخزن بنفس المفاتيح.
  const fallbackUser = {
    name:  'مستخدم التجربة',
    email: 'demo@example.com',
    phone: '0500000000',
    password: 'Demo1234' // للعرض فقط - في الإنتاج لا تُخزّن هنا
  };
  const user = JSON.parse(localStorage.getItem('user_profile') || 'null') || fallbackUser;

  nameEl.value  = user.name  || '';
  emailEl.value = user.email || '';
  phoneEl.value = user.phone || '';

  // ---- تغيير كلمة المرور
  const curPwd = document.getElementById('curPwd');
  const newPwd = document.getElementById('newPwd');
  const newPwd2= document.getElementById('newPwd2');
  const msg    = document.getElementById('msg');
  const toggle = document.getElementById('togglePwd');

  function showMsg(text, ok=false){
    msg.style.display = 'block';
    msg.textContent = text;
    msg.style.color = ok ? '#10b981' : '#fca5a5';
  }

  function validPassword(pwd){
    // 8+، رقم، حرف كبير
    return /[A-Z]/.test(pwd) && /\d/.test(pwd) && pwd.length >= 8;
  }

  toggle?.addEventListener('click', ()=>{
    const type = curPwd.type === 'password' ? 'text' : 'password';
    [curPwd, newPwd, newPwd2].forEach(i => i.type = type);
  });

  form.addEventListener('submit', (e)=>{
    e.preventDefault();

    if (curPwd.value !== (user.password || '')) {
      showMsg('كلمة المرور الحالية غير صحيحة');
      return;
    }
    if (!validPassword(newPwd.value)) {
      showMsg('كلمة المرور الجديدة غير مطابقة للسياسة (8+، رقم، حرف كبير)');
      return;
    }
    if (newPwd.value !== newPwd2.value) {
      showMsg('تأكيد كلمة المرور لا يطابق');
      return;
    }

    // نحفظ التغيير محليًا (Demo)
    user.password = newPwd.value;
    localStorage.setItem('user_profile', JSON.stringify(user));
    showMsg('تم تحديث كلمة المرور بنجاح', true);
    speak('تم تحديث كلمة المرور بنجاح');
    form.reset();
  });
})();


// ✅ تشغيل التتبع
function startGaze() {
  if (!gazeEnabled && window.GazeCloudAPI) {
    gazeEnabled = true;
    try {
      GazeCloudAPI.StartEyeTracking();
      speak("تم تفعيل تتبّع النظر. يمكنك الآن التفاعل بالنظر إلى الأيقونات.");
    } catch (e) {
      console.warn("GazeCloudAPI Start error:", e);
    }
  }
}

// ✅ إيقاف التتبع
function stopGaze() {
  if (gazeEnabled && window.GazeCloudAPI) {
    gazeEnabled = false;
    try {
      GazeCloudAPI.StopEyeTracking();
      speak("تم إيقاف تتبّع النظر مؤقتًا.");
    } catch (e) {
      console.warn("GazeCloudAPI Stop error:", e);
    }
  }
}

// ✅ التفعيل بالنظر فقط — لو المستخدم يطالع الزر 👁️ أو 🛑
if (window.GazeCloudAPI) {
  GazeCloudAPI.OnGaze = function (gazeData) {
    const x = gazeData.docX;
    const y = gazeData.docY;
    const element = document.elementFromPoint(x, y);

    // تحقّق إن المستخدم يطالع الزرّين
    if (element && (element.id === "startTracking" || element.id === "stopTracking")) {
      if (currentTarget !== element) {
        clearTimeout(gazeTimer);
        currentTarget = element;
        gazeTimer = setTimeout(() => {
          if (element.id === "startTracking") startGaze();
          if (element.id === "stopTracking") stopGaze();
        }, gazeHoldTime);
      }
    } else {
      clearTimeout(gazeTimer);
      currentTarget = null;
    }
  };
}

// ✅ دعم الضغط العادي (بالماوس)
if (startBtn) startBtn.addEventListener("click", startGaze);
if (stopBtn)  stopBtn.addEventListener("click", stopGaze);