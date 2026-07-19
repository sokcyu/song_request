import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const db = getFirestore(initializeApp(firebaseConfig));
const $ = (selector) => document.querySelector(selector);
const IH = "f96771da6ff95d114e7389bc1cd1ee3f9e529f9f382879e25eb19b3366c8bbbc";
const PH = "a689f7b77e734dd1b89911d2ba3c7b23f9c0c6f9d16a517301507829061d55e0";
let initialRequestSnapshotLoaded = false;
let knownRequestIds = new Set();

const hash = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const statusLabel = (status) =>
  ({ pending: "승인 대기", approved: "승인 완료", rejected: "거절" })[status] || status || "승인 대기";

function getYouTubeUrl(request) {
  const savedUrl = request.youtubeUrl || request.youtubeLink || request.videoUrl || "";

  try {
    const parsed = new URL(savedUrl);
    const allowed = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
    if (allowed.includes(parsed.hostname)) return parsed.href;
  } catch (_) {
    // 저장된 링크가 없거나 올바르지 않으면 검색 링크를 생성합니다.
  }

  const query = [request.song, request.artist].filter(Boolean).join(" ").trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query || "음원")}`;
}

$("#adminLogin").onclick = async () => {
  if ((await hash($("#adminId").value)) !== IH || (await hash($("#adminPw").value)) !== PH) {
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

async function enableBrowserNotifications() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (_) {}
  }
}

function showAdminNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "./favicon.ico" });
  }
}

function openAdmin() {
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  enableBrowserNotifications();
  listen();
}

function listen() {
  onSnapshot(collection(db, "members"), (snapshot) => {
    const filter = $("#memberFilter").value;
    const members = snapshot.docs
      .map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() }))
      .filter((member) => filter === "all" || member.status === filter);

    $("#members").innerHTML = members.length
      ? members
          .map(
            (member) => `
              <div class="item">
                <b>${escapeHtml(member.name)}</b>
                <div class="muted">${escapeHtml(member.memberId)} · ${escapeHtml(member.email || "-")}</div>
                <span class="badge">${escapeHtml(statusLabel(member.status))}</span>
                <div class="actions">
                  <button class="ok" onclick="ms('${member.id}','approved')">승인</button>
                  <button class="no" onclick="ms('${member.id}','rejected')">거절</button>
                  <button class="delete" onclick="md('${member.id}')">삭제</button>
                </div>
              </div>`,
          )
          .join("")
      : '<div class="empty">회원 없음</div>';
  });

  onSnapshot(collection(db, "requests"), (snapshot) => {
    const requests = snapshot.docs.map((requestDoc) => ({ id: requestDoc.id, ...requestDoc.data() }));

    const currentIds = new Set(requests.map((request) => request.id));
    if (initialRequestSnapshotLoaded) {
      requests
        .filter((request) => !knownRequestIds.has(request.id))
        .forEach((request) => {
          const songTitle = request.requestMode === "lyrics" ? "가사 키워드 신청" : (request.song || "새 신청곡");
          showAdminNotification("CJ스튜디오 새 신청", `${songTitle} · ${request.name || "신청자 미입력"}`);
        });
    }
    knownRequestIds = currentIds;
    initialRequestSnapshotLoaded = true;

    $("#requests").innerHTML = requests.length
      ? requests
          .map((request) => {
            const isLyrics = request.requestMode === "lyrics";
            const title = isLyrics ? "가사 키워드 신청" : request.song || "곡 제목 없음";
            const keywords = (request.lyricsKeywords || []).join(", ");
            const youtubeButton =
              request.status === "approved" && !isLyrics
                ? `<button class="youtube" onclick="ys('${request.id}')">▶ 유튜브 사운드 확인</button>`
                : "";

            return `
              <div class="item">
                <b>${escapeHtml(title)}</b>
                <div class="muted">${escapeHtml(request.artist || "제목·가수 미입력")} · ${escapeHtml(request.genre || "장르 미입력")} · ${escapeHtml(request.name || "신청자 미입력")}</div>
                ${keywords ? `<div class="notice">${escapeHtml(keywords)}</div>` : ""}
                <span class="badge">${escapeHtml(statusLabel(request.status))}</span>
                <div class="actions request-actions">
                  <button class="ok" onclick="rs('${request.id}','approved')">승인</button>
                  <button class="no" onclick="rs('${request.id}','rejected')">거절</button>
                  <button class="delete" onclick="rd('${request.id}')">🗑 삭제</button>
                  ${youtubeButton}
                </div>
              </div>`;
          })
          .join("")
      : '<div class="empty">신청 없음</div>';

    window.requestCache = Object.fromEntries(requests.map((request) => [request.id, request]));
  });

  onSnapshot(doc(db, "settings", "schedule"), (snapshot) => {
    if (snapshot.exists()) {
      $("#schedule").textContent =
        snapshot.data().start.toDate().toLocaleString() + " ~ " + snapshot.data().end.toDate().toLocaleString();
    }
  });
}

window.ms = (id, status) =>
  updateDoc(doc(db, "members", id), { status, reviewedAt: serverTimestamp() });

window.md = async (id) => {
  if (!confirm("이 회원을 삭제하시겠습니까?")) return;
  await deleteDoc(doc(db, "members", id));
};

window.rs = async (id, status) => {
  try {
    const request = window.requestCache?.[id] || {};
    const notice = status === "approved" ? "신청곡이 승인되었습니다." : "신청곡이 거절되었습니다.";

    await updateDoc(doc(db, "requests", id), {
      status,
      notice,
      updatedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "requestNotifications"), {
      requestId: id,
      memberId: request.memberId || request.userId || request.guestId || "",
      applicantName: request.name || "",
      song: request.song || "",
      artist: request.artist || "",
      status,
      message: notice,
      read: false,
      createdAt: serverTimestamp(),
    });

    showAdminNotification("처리 완료", notice);
  } catch (error) {
    console.error(error);
    alert("처리하지 못했습니다.");
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

window.ys = (id) => {
  const request = window.requestCache?.[id];
  if (!request) {
    alert("신청곡 정보를 찾지 못했습니다.");
    return;
  }

  window.open(getYouTubeUrl(request), "_blank", "noopener,noreferrer");
};

$("#saveSchedule").onclick = () =>
  setDoc(doc(db, "settings", "schedule"), {
    start: Timestamp.fromDate(new Date($("#start").value)),
    end: Timestamp.fromDate(new Date($("#end").value)),
    updatedAt: serverTimestamp(),
  });

$("#memberFilter").onchange = () => location.reload();

if (sessionStorage.getItem("adm") === "1") openAdmin();
