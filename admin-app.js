import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  sendPasswordResetEmail, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, onSnapshot, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const $ = s => document.querySelector(s);

let usersCache = [];
let requestsCache = [];
let unsubUsers, unsubRequests, unsubSchedule;

const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

const fmt = value => {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle:"short", timeStyle:"short"
  }).format(date);
};

const toInputValue = date => {
  const z = n => String(n).padStart(2,"0");
  return `${date.getFullYear()}-${z(date.getMonth()+1)}-${z(date.getDate())}T${z(date.getHours())}:${z(date.getMinutes())}`;
};

function showError(error) {
  console.error(error);
  alert(error?.message || String(error));
}

async function verifyAdmin(user) {
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;
  const profile = snap.data();
  return profile.role === "admin" && profile.status === "approved"
    ? profile
    : null;
}

$("#emailLogin").onclick = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      $("#email").value.trim(),
      $("#password").value
    );
  } catch (e) { showError(e); }
};

$("#googleLogin").onclick = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) { showError(e); }
};

$("#resetPassword").onclick = async () => {
  const email = $("#email").value.trim();
  if (!email) {
    alert("관리자 이메일을 먼저 입력하세요.");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    alert("비밀번호 재설정 이메일을 보냈습니다.");
  } catch (e) { showError(e); }
};

$("#logout").onclick = () => signOut(auth);

function renderUsers() {
  const q = $("#userSearch").value.trim().toLowerCase();
  const data = usersCache.filter(u =>
    !q || [u.name, u.email, u.role, u.status].join(" ").toLowerCase().includes(q)
  );

  $("#userList").innerHTML = data.length ? data.map(u => `
    <div class="item">
      <div class="title">${esc(u.name || "이름 없음")}</div>
      <div class="muted">${esc(u.email || "")}<br>권한: ${esc(u.role || "user")}</div>
      <span class="badge">${esc(u.status || "pending")}</span>
      <div class="actions">
        <button class="ok" onclick="approveUser('${u.id}')">✅ 승인</button>
        <button class="no" onclick="suspendUser('${u.id}')">⛔ 정지</button>
        <button class="delete" onclick="removeProfile('${u.id}')">🗑 프로필 삭제</button>
      </div>
    </div>
  `).join("") : '<div class="empty">이용자가 없습니다.</div>';
}

function renderRequests() {
  const q = $("#requestSearch").value.trim().toLowerCase();
  const filter = $("#requestFilter").value;

  const data = requestsCache.filter(r => {
    const matchText = !q || [r.song,r.artist,r.name,r.userEmail,r.type]
      .join(" ").toLowerCase().includes(q);
    const matchStatus = filter === "all" || r.status === filter;
    return matchText && matchStatus;
  });

  $("#requestList").innerHTML = data.length ? data.map(r => `
    <div class="item">
      <div class="title">${esc(r.song || "제목 없음")}</div>
      <div class="muted">
        ${esc(r.artist || "")} · ${esc(r.name || "신청자 없음")}
        <br>${esc(r.type || "user")} · ${r.createdAt ? fmt(r.createdAt) : ""}
      </div>
      <span class="badge">${esc(r.status || "pending")}</span>
      ${r.notice ? `<div class="notice">📢 ${esc(r.notice)}</div>` : ""}
      <div class="actions">
        <button class="ok" onclick="setRequestStatus('${r.id}','approved')" ${r.status !== "pending" ? "disabled" : ""}>✅ 승인</button>
        <button class="no" onclick="setRequestStatus('${r.id}','rejected')" ${r.status !== "pending" ? "disabled" : ""}>❌ 거절</button>
        <button class="youtube" onclick="youtube('${esc(r.song)}','${esc(r.artist)}')">▶ 유튜브</button>
        <button class="delete" onclick="deleteRequest('${r.id}')">🗑 삭제 처리</button>
      </div>
    </div>
  `).join("") : '<div class="empty">신청곡이 없습니다.</div>';
}

window.approveUser = async id => {
  try { await updateDoc(doc(db,"users",id), {status:"approved"}); }
  catch (e) { showError(e); }
};

window.suspendUser = async id => {
  try { await updateDoc(doc(db,"users",id), {status:"suspended"}); }
  catch (e) { showError(e); }
};

window.removeProfile = async id => {
  if (!confirm("Firestore 프로필을 삭제할까요? Authentication 계정은 Firebase 콘솔에서 별도 삭제해야 합니다.")) return;
  try { await deleteDoc(doc(db,"users",id)); }
  catch (e) { showError(e); }
};

window.setRequestStatus = async (id, status) => {
  try {
    const ref = doc(db,"requests",id);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().status !== "pending") {
      alert("이미 처리된 신청입니다.");
      return;
    }
    const notice = status === "approved"
      ? "승인되었습니다. 음원 발매 이후 공고문을 발송하겠습니다."
      : "거절되었습니다. 다른 음원을 말씀해 주세요.";
    await updateDoc(ref, {status, notice, updatedAt:serverTimestamp()});
  } catch (e) { showError(e); }
};

window.deleteRequest = async id => {
  if (!confirm("삭제 처리할까요?")) return;
  try {
    await updateDoc(doc(db,"requests",id), {
      status:"deleted",
      notice:"음원이 부적절함으로 처리되어 삭제되었습니다. 다시 이용해 주시길 바랍니다.",
      updatedAt:serverTimestamp()
    });
  } catch (e) { showError(e); }
};

window.youtube = (song, artist) => window.open(
  "https://www.youtube.com/results?search_query=" + encodeURIComponent(`${artist} ${song}`),
  "_blank"
);

$("#saveSchedule").onclick = async () => {
  const start = $("#startTime").value;
  const end = $("#endTime").value;
  if (!start || !end || new Date(end) <= new Date(start)) {
    alert("올바른 시작·종료 시간을 입력하세요.");
    return;
  }
  try {
    await setDoc(doc(db,"settings","schedule"), {
      start:Timestamp.fromDate(new Date(start)),
      end:Timestamp.fromDate(new Date(end)),
      updatedAt:serverTimestamp()
    });
    alert("예약시간을 저장했습니다.");
  } catch (e) { showError(e); }
};

$("#openOneHour").onclick = () => {
  const start = new Date();
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  $("#startTime").value = toInputValue(start);
  $("#endTime").value = toInputValue(end);
  $("#saveSchedule").click();
};

$("#closeNow").onclick = () => {
  const end = new Date();
  const start = new Date(end.getTime() - 60 * 1000);
  $("#startTime").value = toInputValue(start);
  $("#endTime").value = toInputValue(end);
  $("#saveSchedule").click();
};

$("#userSearch").addEventListener("input", renderUsers);
$("#requestSearch").addEventListener("input", renderRequests);
$("#requestFilter").addEventListener("change", renderRequests);

function stopListeners() {
  if (unsubUsers) unsubUsers();
  if (unsubRequests) unsubRequests();
  if (unsubSchedule) unsubSchedule();
}

onAuthStateChanged(auth, async user => {
  stopListeners();
  $("#loginView").classList.remove("hidden");
  $("#appView").classList.add("hidden");

  if (!user) return;

  try {
    const profile = await verifyAdmin(user);
    if (!profile) {
      alert("승인된 관리자 계정이 아닙니다.");
      await signOut(auth);
      return;
    }

    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    $("#adminName").textContent = profile.name || user.displayName || "관리자";
    $("#adminEmail").textContent = user.email || "";

    unsubUsers = onSnapshot(collection(db,"users"), snap => {
      usersCache = snap.docs.map(d => ({id:d.id, ...d.data()}));
      renderUsers();
    }, showError);

    unsubRequests = onSnapshot(collection(db,"requests"), snap => {
      requestsCache = snap.docs
        .map(d => ({id:d.id, ...d.data()}))
        .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
      renderRequests();
    }, showError);

    unsubSchedule = onSnapshot(doc(db,"settings","schedule"), snap => {
      if (!snap.exists()) {
        $("#scheduleStatus").textContent = "예약시간이 설정되지 않았습니다.";
        return;
      }
      const data = snap.data();
      $("#startTime").value = toInputValue(data.start.toDate());
      $("#endTime").value = toInputValue(data.end.toDate());
      $("#scheduleStatus").textContent = `${fmt(data.start)} ~ ${fmt(data.end)}`;
    }, showError);

  } catch (e) {
    showError(e);
    await signOut(auth);
  }
});
