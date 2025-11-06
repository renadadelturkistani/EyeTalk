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
   🚨 الطوارئ — صوت + إشعار + إيميل + حفظ في Firebase
========================================================= */
const alarm = new Audio("alarm.mp3");
alarm.loop = true;

let pauseTracking   = false;   
let lastFocusedIcon = null;    
let focusStartTime  = null;    
const focusDuration = 800;     

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

function sendEmergencyEmail() {
  try {
    if (!window.emailjs) return;
    const assistantEmail = localStorage.getItem("assistantEmail") || "";
    const assistantName  = localStorage.getItem("assistantName")  || "";
    const patientName    = localStorage.getItem("patientName")    || "";
    if (!assistantEmail) return;
    const EMAILJS_SERVICE_ID = "service_efegnl1";
    const EMAILJS_TEMPLATE_ID = "template_m5ktrtb";
    const EMAILJS_PUBLIC_KEY  = "DX_7hfu4mvcCyCf9B";
    const params = {
      assistant_name: assistantName,
      email: assistantEmail,
      name: patientName,
      time: new Date().toLocaleString("ar-SA")
    };
    return emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      params,
      EMAILJS_PUBLIC_KEY
    );
  } catch (e) { console.warn("EmailJS send error:", e); }
}

function triggerEmergency() {
  try { alarm.play(); } catch (_) {}
  pauseTracking = true;
  if (stopBtn) stopBtn.style.display = "block";
  speak("حالة طارئة");
  Promise.resolve(sendEmergencyEmail())
    .then(() => console.log("✅ تم إرسال إيميل الطوارئ بنجاح"))
    .catch(err => console.warn("⚠️ فشل إرسال الإيميل:", err));
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
    div.dataset.speech = item.label;                     
    div.dataset.action = isEmergency ? "emergency" : ""; 
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

    if (cursorDot) { 
      cursorDot.style.left = `${x}px`; 
      cursorDot.style.top  = `${y}px`; 
    }

    const el = document.elementFromPoint(x, y);
    const icon = el?.closest ? el.closest(".icon") : (el && el.classList && el.classList.contains("icon") ? el : null);

    /* =========================================================
       🔈 التحكم في الصوت بالنظر (كتم / تشغيل)
    ========================================================== */
    const muteBtn = document.getElementById("muteButton");
    const unmuteBtn = document.getElementById("unmuteButton");
    let stayed;

    if (el === muteBtn || el === unmuteBtn) {
      if (el !== window.lastFocusedControl) {
        window.lastFocusedControl = el;
        window.focusStartTimeControl = Date.now();
      } else {
        stayed = Date.now() - window.focusStartTimeControl >= focusDuration;
        if (stayed) {
          if (el.id === "muteButton") {
            try {
              window.speechSynthesis.cancel();
              speak("تم كتم الصوت");
            } catch (_) {}
          } else if (el.id === "unmuteButton") {
            try {
              speak("تم تشغيل الصوت");
            } catch (_) {}
          }
          window.lastFocusedControl = null;
          window.focusStartTimeControl = null;
        }
      }
      return; // نوقف هنا عشان ما يدخل في منطق الأيقونات
    } else {
      window.lastFocusedControl = null;
      window.focusStartTimeControl = null;
    }

    /* =========================================================
       🎯 منطق الأيقونات — بدون تعديل
    ========================================================== */
    if (icon) {
      if (icon !== lastFocusedIcon) { 
        lastFocusedIcon = icon; 
        focusStartTime = Date.now(); 
      } else {
        stayed = Date.now() - focusStartTime >= focusDuration;
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

  try { GazeCloudAPI.StartEyeTracking(); } catch (_) {}
}

/* =========================================================
   🧭 السايدبار + تفضيلات المظهر (ثيم/حجم خط)
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
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

  try {
    const cls  = localStorage.getItem('app_theme_cls') || 'theme-dark';
    document.body.classList.remove('theme-dark','theme-light');
    document.body.classList.add(cls);

    const pct  = +localStorage.getItem('app_font_pct') || 100;
    document.documentElement.style.setProperty('--base-font', pct + '%');
  } catch (_) {}
});

/* =========================================================
   🧩 صفحة الإعدادات — عناصرها اختيارية
========================================================= */
(function wireSettingsPage(){
  const darkToggle = document.getElementById('darkModeToggle');
  const darkLabel  = document.getElementById('darkLabel');
  const range      = document.getElementById('fontSizeRange');
  const fontValue  = document.getElementById('fontValue');

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
   👤 صفحة الملف الشخصي
========================================================= */
(function profilePage(){
  const nameEl = document.getElementById('uName');
  const emailEl= document.getElementById('uEmail');
  const phoneEl= document.getElementById('uPhone');
  const form   = document.getElementById('pwdForm');
  if (!nameEl || !emailEl || !phoneEl || !form) return;

  const fallbackUser = {
    name:  'مستخدم التجربة',
    email: 'demo@example.com',
    phone: '0500000000',
    password: 'Demo1234'
  };
  const user = JSON.parse(localStorage.getItem('user_profile') || 'null') || fallbackUser;
  nameEl.value  = user.name  || '';
  emailEl.value = user.email || '';
  phoneEl.value = user.phone || '';

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
    user.password = newPwd.value;
    localStorage.setItem('user_profile', JSON.stringify(user));
    showMsg('تم تحديث كلمة المرور بنجاح', true);
    speak('تم تحديث كلمة المرور بنجاح');
    form.reset();
  });
})();
