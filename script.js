(() => {
  "use strict";
  const cfg = window.KHATAM_CONFIG || {};
  const STORAGE_KEY = `khatam-drive-${cfg.driveId || "default"}`;
  const OWNER_KEY = `khatam-owner-${cfg.driveId || "default"}`;
  // This UID is checked in the UI as well as by the Firebase Realtime Database rules.
  const ADMIN_UID = "WfxrXaXHL7Vtq8UZJIt6Nr3LDro1";
  const juzList = [
    ["الم","Alif Lam Mim"],["سَيَقُولُ","Sayaqool"],["تِلْكَ الرُّسُلُ","Tilkal Rusul"],
    ["لَنْ تَنَالُوا","Lan Tanaaloo"],["وَالْمُحْصَنَاتُ","Wal Mohsanat"],["لَا يُحِبُّ اللَّهُ","La Yuhibbullah"],
    ["وَإِذَا سَمِعُوا","Wa Iza Sami‘u"],["وَلَوْ أَنَّنَا","Wa Lau Annana"],["قَالَ الْمَلَأُ","Qalal Mala’u"],
    ["وَاعْلَمُوا","Wa A‘lamu"],["يَعْتَذِرُونَ","Ya‘taziroon"],["وَمَا مِنْ دَابَّةٍ","Wa Ma Min Dabbah"],
    ["وَمَا أُبَرِّئُ","Wa Ma Ubarri’u"],["رُبَمَا","Rubama"],["سُبْحَانَ الَّذِي","Subhanalladhi"],
    ["قَالَ أَلَمْ","Qala Alam"],["اقْتَرَبَ لِلنَّاسِ","Iqtaraba Linnaas"],["قَدْ أَفْلَحَ","Qad Aflaha"],
    ["وَقَالَ الَّذِينَ","Wa Qalalladhina"],["أَمَّنْ خَلَقَ","Amman Khalaq"],["اتْلُ مَا أُوحِيَ","Utlu Ma Oohiya"],
    ["وَمَنْ يَقْنُتْ","Wa Man Yaqnut"],["وَمَا لِيَ","Wa Mali"],["فَمَنْ أَظْلَمُ","Faman Azlam"],
    ["إِلَيْهِ يُرَدُّ","Ilaihi Yuraddu"],["حم","Ha Meem"],["قَالَ فَمَا خَطْبُكُمْ","Qala Fama Khatbukum"],
    ["قَدْ سَمِعَ اللَّهُ","Qad Sami Allah"],["تَبَارَكَ الَّذِي","Tabarakalladhi"],["عَمَّ","Amma"]
  ];
  const $ = (id) => document.getElementById(id);
  let activeJuz = null, adminTab = "overview", toastTimer;
  let firebaseDb = null, firebaseAuth = null, firebaseUser = null, liveMode = false, firebaseReady = false, suppressRemote = false;
  let driveMeta = {
    title: cfg.title || "Khatamul Qur’an",
    marhoomName: cfg.marhoomName || "[Name of the Marhoom]",
    subtitle: cfg.subtitle || "May every letter recited be a means of mercy, light and lasting reward.",
    hadithText: cfg.hadithText || "Whoever recites a letter from the Book of Allah will receive a good deed, and a good deed is multiplied tenfold.",
    hadithSource: cfg.hadithSource || "Jamiʿ at-Tirmidhi 2910",
    logoPath: cfg.logoPath || "assets/logo-placeholder.svg"
  };
  const emptyJuz = () => juzList.map((j, i) => ({number:i+1, arabic:j[0], transliteration:j[1], status:"available", reader:"", ownerToken:"", completedAt:null}));
  let state = { juz: emptyJuz() };

  function readLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.juz) && saved.juz.length === 30) {
        state.juz = saved.juz.map((item, i) => ({...emptyJuz()[i], ...item, number:i+1}));
      }
      const savedMeta = JSON.parse(localStorage.getItem(`${STORAGE_KEY}-meta`) || "null");
      if (savedMeta) driveMeta = {...driveMeta, ...savedMeta};
    } catch (e) { console.warn("Could not read saved drive data", e); }
  }
  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(`${STORAGE_KEY}-meta`, JSON.stringify(driveMeta));
    // Drive metadata stays in config.js/GitHub. Public visitors must not be able
    // to overwrite shared configuration from the browser dashboard.
  }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function showToast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
  }
  function counts() {
    const reading = state.juz.filter(j => j.status === "reading").length;
    const completed = state.juz.filter(j => j.status === "completed").length;
    return {reading, completed, available:30-reading-completed, percent:Math.round(completed/30*100)};
  }
  function renderMeta() {
    document.title = `${driveMeta.title} | ${driveMeta.marhoomName}`;
    $("brandTitle").textContent = driveMeta.title.toUpperCase();
    $("marhoomName").textContent = driveMeta.marhoomName;
    $("driveSubtitle").textContent = driveMeta.subtitle;
    $("hadithText").textContent = `“${driveMeta.hadithText}”`;
    $("hadithSource").textContent = driveMeta.hadithSource;
    $("siteLogo").src = driveMeta.logoPath;
    $("siteLogo").onerror = () => {$("siteLogo").src = "assets/logo-placeholder.svg";};
    $("footerDriveName").textContent = `${driveMeta.title} · ${driveMeta.marhoomName}`;
  }
  function renderStats() {
    const c = counts();
    $("totalCount").textContent = "30"; $("readingCount").textContent = c.reading;
    $("completedCount").textContent = c.completed; $("progressPercent").textContent = `${c.percent}%`;
    $("progressRing").style.setProperty("--progress", `${c.percent}%`);
  }
  function statusText(j) {
    if (j.status === "completed") return `✓ Completed${j.reader ? ` by ${j.reader}` : ""}`;
    if (j.status === "reading") return `Being read by ${j.reader}`;
    return "Available to read";
  }
  function renderGrid() {
    $("juzGrid").innerHTML = state.juz.map(j => `
      <button class="juz-card ${j.status}" data-juz="${j.number}" aria-label="Juz ${j.number}, ${esc(j.transliteration)}, ${esc(statusText(j))}">
        <span class="juz-number">${String(j.number).padStart(2,"0")}</span>
        <span class="juz-arabic" lang="ar" dir="rtl">${j.arabic}</span>
        <span class="juz-translit">${esc(j.transliteration)}</span>
        <span class="juz-status">${esc(statusText(j))}</span>
      </button>`).join("");
    renderStats();
  }
  function openJuz(number) {
    activeJuz = state.juz[number-1];
    $("modalEyebrow").textContent = `JUZ ${String(number).padStart(2,"0")}`;
    $("modalTitle").textContent = activeJuz.arabic;
    $("modalTranslit").textContent = activeJuz.transliteration;
    renderJuzModal();
    $("juzModal").hidden = false;
    document.body.style.overflow = "hidden";
  }
  function renderJuzModal() {
    const j = activeJuz;
    const body = $("modalBody");
    if (j.status === "available") {
      body.innerHTML = `<p class="modal-body-copy">This Juz is available. Add your name to let others know you intend to recite it.</p>
        <label class="field-label" for="readerName">Your name</label><input class="field" id="readerName" maxlength="80" autocomplete="name" placeholder="Enter your name">
        <button class="button green full" id="claimJuz">☾ &nbsp; I will read this Juz</button>
        <p class="modal-footnote">Your name will be visible to others. Please only claim a Juz you intend to complete.</p>`;
      $("claimJuz").addEventListener("click", claimActiveJuz);
      $("readerName").addEventListener("keydown", e => {if(e.key==="Enter") claimActiveJuz();});
    } else if (j.status === "reading") {
      const isOwner = !!j.ownerToken && j.ownerToken === localStorage.getItem(OWNER_KEY);
      body.innerHTML = `<p class="modal-body-copy">This Juz is currently being read by</p><h3 style="font-family:'Playfair Display',serif;color:var(--green);margin:0 0 18px">${esc(j.reader)}</h3>
        <div class="admin-actions" style="justify-content:center"><button class="button green" id="completeJuz">${isOwner ? "✓ Mark as completed" : "I have completed this Juz"}</button></div>
        ${isOwner ? `<button class="button outline full" id="releaseJuz">Release this Juz</button>` : `<p class="modal-footnote">If you are the reader, you can mark this Juz as completed on this device. For shared production use, add the backend setup in README.</p>`}
        <p class="modal-footnote">May Allah make your recitation easy and accept it.</p>`;
      $("completeJuz").addEventListener("click", () => completeJuz(j.number));
      if (isOwner) $("releaseJuz").addEventListener("click", () => releaseJuz(j.number));
    } else {
      body.innerHTML = `<div class="success-panel"><div class="success-icon">✓</div><h3>Alhamdulillah!</h3><p>Juz ${String(j.number).padStart(2,"0")} · ${esc(j.transliteration)} has been completed${j.reader ? ` by ${esc(j.reader)}` : ""}.</p><p>May Allah accept the recitation and grant the marhoom mercy and forgiveness. Ameen.</p></div>
        <button class="button outline full" id="closeCompleted">JazakAllahu Khairan</button>`;
      $("closeCompleted").addEventListener("click", () => closeModal("juzModal"));
    }
  }
  function claimActiveJuz() {
    const name = $("readerName")?.value.trim();
    if (!name) { showToast("Please enter your name first."); $("readerName")?.focus(); return; }
    if (activeJuz.status !== "available") { showToast("This Juz has already been taken."); closeModal("juzModal"); return; }
    const token = firebaseUser?.uid || (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    if (liveMode && firebaseReady) {
      claimRemoteJuz(activeJuz.number, name, token);
      return;
    }
    activeJuz.status = "reading"; activeJuz.reader = name; activeJuz.ownerToken = token;
    localStorage.setItem(OWNER_KEY, token);
    saveLocal(); renderGrid(); renderJuzModal();
    showToast("Juz reserved in this browser. Connect Firebase for shared updates.");
  }
  function completeJuz(number) {
    const j = state.juz[number-1];
    if (!j || j.status !== "reading") return;
    if (liveMode && firebaseReady) {
      completeRemoteJuz(number);
      return;
    }
    j.status = "completed"; j.completedAt = new Date().toISOString();
    saveLocal(); renderGrid(); renderJuzModal(); showToast("Alhamdulillah! Juz marked as completed.");
  }
  function releaseJuz(number) {
    const j = state.juz[number-1];
    if (!j) return;
    if (liveMode && firebaseReady) {
      showToast("Releasing claims needs organiser authentication; use Firebase Console for this prototype.");
      return;
    }
    Object.assign(j, {status:"available", reader:"", ownerToken:"", completedAt:null});
    saveLocal(); renderGrid(); renderJuzModal(); showToast("Juz is available again.");
  }
  function closeModal(id) {
    $(id).hidden = true; document.body.style.overflow = "";
  }
  function openOrganiser() {
    $("organiserModal").hidden = false; document.body.style.overflow = "hidden";
    renderAdmin();
  }
  function renderAdmin() {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === adminTab));
    const panel = $("adminPanel"), c = counts();
    if (adminTab === "overview") {
      const isAdmin = !!firebaseUser && firebaseUser.uid === ADMIN_UID;
      const authPanel = isAdmin
        ? `<div class="success-panel" style="margin-bottom:18px"><h3>Organiser access active</h3><p>You are signed in with the organiser account.</p><button class="button outline" id="organiserSignOut">Sign out</button></div>`
        : `<form id="organiserLogin" class="admin-form" style="margin-bottom:22px">
             <div class="wide"><p class="muted">Sign in with the organiser email and password to access the shared-drive reset.</p></div>
             <div class="wide"><label for="organiserEmail">Organiser email</label><input class="field" id="organiserEmail" type="email" autocomplete="username" required maxlength="254"></div>
             <div class="wide"><label for="organiserPassword">Password</label><input class="field" id="organiserPassword" type="password" autocomplete="current-password" required></div>
             <div class="wide admin-actions"><button class="button green" type="submit" ${firebaseReady ? "" : "disabled"}>Sign in</button></div>
             <div class="wide"><small class="muted">${firebaseReady ? "Organiser sign-in is available." : "Waiting for Firebase to connect. Refresh the page if this message remains."}</small></div>
           </form>`;
      panel.innerHTML = `${authPanel}<div class="admin-stats"><div class="admin-stat"><strong>${c.available}</strong><span>Available</span></div><div class="admin-stat"><strong>${c.reading}</strong><span>Being read</span></div><div class="admin-stat"><strong>${c.completed}</strong><span>Completed</span></div></div>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>#</th><th>Juz name</th><th>Status</th><th>Reader</th><th>Action</th></tr></thead><tbody>${state.juz.map(j=>`<tr><td>${j.number}</td><td><span lang="ar" dir="rtl">${j.arabic}</span><br><small>${esc(j.transliteration)}</small></td><td><span class="status-pill ${j.status}">${j.status==="reading"?"Being read":j.status==="completed"?"Completed":"Available"}</span></td><td>${esc(j.reader||"—")}</td><td><button class="table-action" data-admin-juz="${j.number}">Manage</button></td></tr>`).join("")}</tbody></table></div>
        <div class="admin-actions"><button class="button outline" id="exportCsv">Export CSV</button>${isAdmin ? '<button class="button outline" id="resetDrive">Reset all Juz</button>' : ''}</div>`;
      panel.querySelectorAll("[data-admin-juz]").forEach(b => b.addEventListener("click", () => {closeModal("organiserModal");openJuz(Number(b.dataset.adminJuz));}));
      $("exportCsv").addEventListener("click", exportCsv);
      if (isAdmin) {
        $("resetDrive").addEventListener("click", resetDrive);
        $("organiserSignOut").addEventListener("click", signOutOrganiser);
      } else {
        $("organiserLogin").addEventListener("submit", signInOrganiser);
      }
    } else if (adminTab === "settings") {
      const isAdmin = !!firebaseUser && firebaseUser.uid === ADMIN_UID;
      if (!isAdmin) {
        panel.innerHTML = `<div class="empty-state"><h3>Organiser access required</h3><p>Drive details are available only to the signed-in organiser.</p><button class="button green" id="goToOrganiserLogin">Go to organiser sign-in</button></div>`;
        $("goToOrganiserLogin").addEventListener("click", () => { adminTab = "overview"; renderAdmin(); });
        return;
      }
      panel.innerHTML = `<p class="muted">These details are saved in this browser in demo mode. To change the default for everyone, edit <code>config.js</code> in your GitHub repository.</p>
        <form id="driveSettings" class="admin-form">
          <div><label for="settingTitle">Drive title</label><input class="field" id="settingTitle" value="${esc(driveMeta.title)}" maxlength="80"></div>
          <div><label for="settingName">Marhoom's name</label><input class="field" id="settingName" value="${esc(driveMeta.marhoomName)}" maxlength="120"></div>
          <div class="wide"><label for="settingSubtitle">Introductory message</label><textarea class="field" id="settingSubtitle" rows="2" maxlength="300">${esc(driveMeta.subtitle)}</textarea></div>
          <div><label for="settingHadith">Hadith text</label><textarea class="field" id="settingHadith" rows="3" maxlength="500">${esc(driveMeta.hadithText)}</textarea></div>
          <div><label for="settingSource">Hadith reference</label><input class="field" id="settingSource" value="${esc(driveMeta.hadithSource)}" maxlength="100"></div>
          <div class="wide"><label for="settingLogo">Logo path or URL</label><input class="field" id="settingLogo" value="${esc(driveMeta.logoPath)}"></div>
          <div class="wide admin-actions"><button class="button green" type="submit">Save drive details</button><button class="button outline" type="button" id="restoreConfig">Restore config.js defaults</button></div>
        </form>`;
      $("driveSettings").addEventListener("submit", e => {
        e.preventDefault();
        driveMeta = {...driveMeta,title:$("settingTitle").value.trim()||"Khatamul Qur’an",marhoomName:$("settingName").value.trim()||"[Name of the Marhoom]",subtitle:$("settingSubtitle").value.trim(),hadithText:$("settingHadith").value.trim(),hadithSource:$("settingSource").value.trim(),logoPath:$("settingLogo").value.trim()||"assets/logo-placeholder.svg"};
        saveLocal(); renderMeta(); showToast("Drive details saved in this browser."); renderAdmin();
      });
      $("restoreConfig").addEventListener("click", () => {driveMeta = {title:cfg.title,marhoomName:cfg.marhoomName,subtitle:cfg.subtitle,hadithText:cfg.hadithText,hadithSource:cfg.hadithSource,logoPath:cfg.logoPath};saveLocal();renderMeta();renderAdmin();showToast("Restored config.js defaults.");});
    } else {
      panel.innerHTML = `<p class="muted">Download a CSV snapshot for record-keeping, or manage an individual Juz from the overview tab. In demo mode, the data belongs to this browser only.</p><div class="admin-actions"><button class="button green" id="exportCsv2">Export Juz data (CSV)</button><button class="button outline" id="downloadJson">Download backup (JSON)</button><label class="button outline" for="importJson" style="cursor:pointer">Restore JSON backup</label><input id="importJson" type="file" accept="application/json" hidden></div><div class="empty-state" style="margin-top:18px">For a real multi-user drive, configure Supabase and authenticated organiser access before sharing the link.</div>`;
      $("exportCsv2").addEventListener("click", exportCsv);
      $("downloadJson").addEventListener("click", downloadJson);
      $("importJson").addEventListener("change", importJson);
    }
  }
  function exportCsv() {
    const rows = [["Juz","Arabic name","Transliteration","Status","Reader","Completed at"], ...state.juz.map(j=>[j.number,j.arabic,j.transliteration,j.status,j.reader,j.completedAt||""])];
    const csv = rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    downloadBlob(csv, `khatam-${cfg.slug||"drive"}-juz.csv`, "text/csv;charset=utf-8");
  }
  function downloadJson() { downloadBlob(JSON.stringify({driveMeta,state},null,2),`khatam-${cfg.slug||"drive"}-backup.json`,"application/json"); }
  function downloadBlob(content, filename, type) {
    const blob = new Blob([content],{type}), url = URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
  }
  function importJson(e) {
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();reader.onload=()=>{
      try{const data=JSON.parse(reader.result);if(!data.state||!Array.isArray(data.state.juz)||data.state.juz.length!==30)throw new Error("Invalid backup");state=data.state;if(data.driveMeta)driveMeta={...driveMeta,...data.driveMeta};saveLocal();renderMeta();renderGrid();renderAdmin();showToast("Backup restored.");}
      catch(err){showToast("Could not restore that backup file.");}
    };reader.readAsText(file);
  }
  async function signInOrganiser(event) {
    event.preventDefault();
    if (!firebaseReady || !firebaseAuth) { showToast("Firebase is not connected yet. Please refresh and try again."); return; }
    const email = $("organiserEmail").value.trim();
    const password = $("organiserPassword").value;
    try {
      const {signInWithEmailAndPassword} = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      if (credential.user.uid !== ADMIN_UID) {
        const {signOut, signInAnonymously} = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        await signOut(firebaseAuth);
        const anon = await signInAnonymously(firebaseAuth);
        firebaseUser = anon.user;
        renderAdmin();
        showToast("This account is not authorised as the organiser.");
        return;
      }
      firebaseUser = credential.user;
      renderAdmin();
      showToast("Organiser signed in successfully.");
    } catch (error) {
      console.error("Organiser sign-in failed", error);
      showToast(error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password" || error?.code === "auth/user-not-found" ? "Email or password is incorrect." : "Could not sign in. Check the account and try again.");
    }
  }

  async function signOutOrganiser() {
    if (!firebaseAuth) return;
    try {
      const {signOut, signInAnonymously} = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      await signOut(firebaseAuth);
      const anon = await signInAnonymously(firebaseAuth);
      firebaseUser = anon.user;
      renderAdmin();
      showToast("Signed out of organiser access.");
    } catch (error) {
      console.error("Organiser sign-out failed", error);
      showToast("Could not sign out cleanly. Please refresh the page.");
    }
  }

  async function resetDrive() {
    if (!firebaseReady || !firebaseDb || !firebaseUser || firebaseUser.uid !== ADMIN_UID) {
      showToast("Only the signed-in organiser can reset the shared drive.");
      return;
    }
    if (!confirm("Reset all 30 Juz for EVERYONE? All reader names and completion statuses will be cleared.")) return;
    try {
      const {ref, set} = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
      const fresh = {};
      for (const j of emptyJuz()) fresh[j.number] = {...j, ownerUid:"", ownerToken:""};
      await set(ref(firebaseDb, `drives/${cfg.driveId || "default"}/juz`), fresh);
      state = {juz: emptyJuz().map(j => ({...j, ownerUid:""}))};
      saveLocal(); renderGrid(); renderAdmin();
      showToast("Alhamdulillah — all 30 Juz are available again.");
    } catch (error) {
      console.error("Shared drive reset failed", error);
      showToast("Reset failed. Check Firebase rules and organiser sign-in.");
    }
  }
  function initEvents() {
    $("juzGrid").addEventListener("click", e => {const card=e.target.closest("[data-juz]");if(card)openJuz(Number(card.dataset.juz));});
    $("organiserOpen").addEventListener("click", openOrganiser);
    $("footerOrganiser").addEventListener("click", openOrganiser);
    $("menuToggle").addEventListener("click", () => $("main") && document.querySelector(".desktop-nav").classList.toggle("open"));
    document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));
    document.querySelectorAll(".modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",e=>{if(e.target===backdrop)closeModal(backdrop.id);}));
    document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-backdrop:not([hidden])").forEach(m=>closeModal(m.id));});
    document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{adminTab=b.dataset.tab;renderAdmin();}));
  }
  async function initFirebase() {
    const fc = cfg.firebaseConfig || {};
    if (!fc.apiKey || fc.apiKey === "PASTE_API_KEY_HERE" || !fc.projectId || !fc.databaseURL || fc.databaseURL.includes("PASTE_")) return;
    try {
      const appMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      const dbMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
      const app = appMod.initializeApp(fc);
      firebaseAuth = authMod.getAuth(app);
      firebaseDb = dbMod.getDatabase(app);
      const credential = await authMod.signInAnonymously(firebaseAuth);
      firebaseUser = credential.user;
      liveMode = true;
      firebaseReady = true;
      $("organiserModeNote").textContent = "Firebase live mode: Juz statuses synchronise across visitors. Organiser overrides still require a secured admin workflow.";
      const driveRef = dbMod.ref(firebaseDb, `drives/${cfg.driveId || "default"}`);
      const snap = await dbMod.get(driveRef);
      if (!snap.exists()) {
        // Seed each child separately because Realtime Database rules are evaluated
        // at the exact write path; a parent write would bypass child-level rules.
        for (const j of emptyJuz()) {
          await dbMod.set(dbMod.ref(firebaseDb, `drives/${cfg.driveId || "default"}/juz/${j.number}`), {...j, ownerUid:""});
        }
      } else {
        const data = snap.val();
        if (data.juz) {
          state.juz = emptyJuz().map(j => ({...j,...(data.juz[j.number] || {})}));
          renderGrid();
        }
      }
      dbMod.onValue(dbMod.ref(firebaseDb, `drives/${cfg.driveId || "default"}/juz`), snapJuz => {
        const remote = snapJuz.val() || {};
        suppressRemote = true;
        state.juz = emptyJuz().map(j => ({...j,...(remote[j.number] || {})}));
        saveLocal(); renderGrid();
        if (activeJuz) {
          activeJuz = state.juz[activeJuz.number-1];
          if (!$("juzModal").hidden) renderJuzModal();
        }
        if (!$("organiserModal").hidden) renderAdmin();
        suppressRemote = false;
      });
      showToast("Connected. Juz statuses will update for everyone.");
    } catch (e) {
      console.error("Firebase initialisation failed", e);
      liveMode = false; firebaseReady = false;
      showToast("Firebase could not connect. Check config and rules; using browser demo mode.");
    }
  }
  async function claimRemoteJuz(number, name, uid) {
    try {
      const {ref, runTransaction} = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
      const juzRef = ref(firebaseDb, `drives/${cfg.driveId || "default"}/juz/${number}`);
      const result = await runTransaction(juzRef, current => {
        if (!current || current.status !== "available") return;
        return {...current,status:"reading",reader:name,ownerUid:uid,ownerToken:"",completedAt:null};
      });
      if (!result.committed) { showToast("Sorry, someone has just claimed this Juz."); return; }
      activeJuz = state.juz[number-1];
      showToast("Juz reserved. May Allah accept your intention.");
    } catch (e) { console.error(e); showToast("Could not reserve this Juz. Please try again."); }
  }
  async function completeRemoteJuz(number) {
    try {
      const {ref, runTransaction} = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");
      const juzRef = ref(firebaseDb, `drives/${cfg.driveId || "default"}/juz/${number}`);
      const result = await runTransaction(juzRef, current => {
        if (!current || current.status !== "reading" || current.ownerUid !== firebaseUser?.uid) return;
        return {...current,status:"completed",completedAt:new Date().toISOString()};
      });
      if (!result.committed) { showToast("Only the person who claimed this Juz can complete it on this device."); return; }
      showToast("Alhamdulillah! Juz marked as completed.");
    } catch (e) { console.error(e); showToast("Could not update this Juz. Please try again."); }
  }
  async function init() {
    readLocal(); renderMeta(); renderGrid(); initEvents();
    await initFirebase();
  }
  init();
})();