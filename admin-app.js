import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, updateDoc, deleteDoc, collection,
  onSnapshot, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const db = getFirestore(initializeApp(firebaseConfig));
const $ = (selector) => document.querySelector(selector);
const IH = "f96771da6ff95d114e7389bc1cd1ee3f9e529f9f382879e25eb19b3366c8bbbc";
const PH = "a689f7b77e734dd1b89911d2ba3c7b23f9c0c6f9d16a517301507829061d55e0";

const STATUS_LABELS = {
  pending: "승인 대기",
  approved: "신청 승인",
  rejected: "신청 거절",
  production_pending: "제작 대기",
  production_completed: "제작 완료",
  production_cancelled: "제작 취소"
};

const NOTICE_TEXT = {
  approved: "신청곡이 승인되었습니다.",
  rejected: "신청곡이 거절되었습니다.",
  production_pending: "승인된 음원이 제작 대기 상태입니다.",
  production_completed: "신청하신 음원 제작이 완료되었습니다.",
  production_cancelled: "신청하신 음원 제작이 취소되었습니다."
};

const hash = async (text) => [...new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
)].map((b) => b.toString(16).padStart(2, "0")).join("");

$("#adminLogin").onclick = async () => {
  if (await hash($("#adminId").value) !== IH || await hash($("#adminPw").value) !== PH) {
    $("#loginMsg").classList.remove("hidden");
    $("#loginMsg").textContent = "로그인 정보가 올바르지 않습니다.";
    return;
  }
  sessionStorage.setItem("adm", "1");
  openAdmin();
};

$("#logout").onclick = () => {
  sessionStorage.removeItem("adm");
  location.reload();
};

function openAdmin() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  listen();
}

function listen() {
  onSnapshot(collection(db, "members"), (snapshot) => {
    const filter = $("#memberFilter").value;
    const members = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((x) => filter === "all" || x.status === filter);

    $("#members").innerHTML = members.length ? members.map((x) => `
      <div class="item">
        <b>${x.name}</b>
        <div class="muted">${x.memberId} · ${x.email || "-"}</div>
        <span class="badge">${STATUS_LABELS[x.status] || x.status}</span>
        <div class="actions member-actions">
          <button class="ok" onclick="ms('${x.id}','approved')">승인</button>
          <button class="no" onclick="ms('${x.id}','rejected')">거절</button>
          <button class="delete" onclick="md('${x.id}')">삭제</button>
        </div>
      </div>`).join("") : '<div class="empty">회원 없음</div>';
  });

  onSnapshot(collection(db, "requests"), (snapshot) => {
    const filter = $("#requestFilter").value;
    const requests = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((x) => filter === "all" || x.status === filter);

    $("#requests").innerHTML = requests.length ? requests.map((x) => `
      <div class="item">
        <b>${x.requestMode === "lyrics" ? "가사 키워드 신청" : (x.song || "곡명 미입력")}</b>
        <div class="muted">${x.artist || "제목·가수 미입력"} · ${x.genre || "장르 미입력"} · ${x.name || "이름 미입력"}</div>
        <div class="notice">${(x.lyricsKeywords || []).join(", ")}</div>
        <span class="badge status-${x.status || "pending"}">${STATUS_LABELS[x.status] || x.status || "승인 대기"}</span>
        <div class="actions request-actions">
          <button class="ok" onclick="rs('${x.id}','approved')">승인</button>
          <button class="no" onclick="rs('${x.id}','rejected')">거절</button>
          <button class="waiting" onclick="rs('${x.id}','production_pending')">제작 대기</button>
          <button class="complete" onclick="rs('${x.id}','production_completed')">제작 완료</button>
          <button class="cancel" onclick="rs('${x.id}','production_cancelled')">제작 취소</button>
          <button class="delete" onclick="rd('${x.id}')">삭제</button>
        </div>
      </div>`).join("") : '<div class="empty">신청 없음</div>';
  });

  onSnapshot(doc(db, "settings", "schedule"), (snapshot) => {
    if (snapshot.exists()) {
      $("#schedule").textContent = snapshot.data().start.toDate().toLocaleString() +
        " ~ " + snapshot.data().end.toDate().toLocaleString();
    }
  });
}

window.ms = (id, status) => updateDoc(doc(db, "members", id), {
  status,
  reviewedAt: serverTimestamp()
});

window.md = async (id) => {
  if (!confirm("이 회원을 삭제하시겠습니까?")) return;
  await deleteDoc(doc(db, "members", id));
};

window.rs = async (id, status) => {
  const label = STATUS_LABELS[status] || status;
  if (!confirm(`상태를 '${label}'(으)로 변경하시겠습니까?`)) return;

  try {
    await updateDoc(doc(db, "requests", id), {
      status,
      notice: NOTICE_TEXT[status] || label,
      updatedAt: serverTimestamp(),
      productionUpdatedAt: status.startsWith("production_") ? serverTimestamp() : null
    });
  } catch (error) {
    console.error(error);
    alert("상태를 변경하지 못했습니다.");
  }
};

window.rd = async (id) => {
  if (!confirm("이 신청곡을 완전히 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다.")) return;
  try {
    await deleteDoc(doc(db, "requests", id));
    alert("신청곡이 완전히 삭제되었습니다.");
  } catch (error) {
    console.error(error);
    alert("삭제하지 못했습니다.");
  }
};

$("#saveSchedule").onclick = () => setDoc(doc(db, "settings", "schedule"), {
  start: Timestamp.fromDate(new Date($("#start").value)),
  end: Timestamp.fromDate(new Date($("#end").value)),
  updatedAt: serverTimestamp()
});

$("#memberFilter").onchange = () => location.reload();
$("#requestFilter").onchange = () => location.reload();

if (sessionStorage.getItem("adm") === "1") openAdmin();
