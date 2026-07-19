import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const STORAGE_KEY = "cjstudio_last_request_id";
const STATUS_KEY = "cjstudio_last_request_status";

function ensureToast() {
  let toast = document.querySelector("#cjRealtimeToast");
  if (toast) return toast;

  toast = document.createElement("div");
  toast.id = "cjRealtimeToast";
  toast.className = "cj-realtime-toast";
  toast.innerHTML = `
    <strong id="cjRealtimeTitle">신청 결과 알림</strong>
    <div id="cjRealtimeMessage"></div>
    <button type="button" id="cjRealtimeClose">확인</button>
  `;
  document.body.appendChild(toast);
  toast.querySelector("#cjRealtimeClose").onclick = () => toast.classList.remove("show");
  return toast;
}

async function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch (_) {}
  }
}

function notify(status, message, request) {
  const approved = status === "approved";
  const title = approved ? "✅ 신청곡 승인" : "❌ 신청곡 거절";
  const song = [request.song, request.artist].filter(Boolean).join(" - ");
  const body = song ? `${song}\n${message}` : message;

  const toast = ensureToast();
  toast.classList.toggle("approved", approved);
  toast.classList.toggle("rejected", !approved);
  toast.querySelector("#cjRealtimeTitle").textContent = title;
  toast.querySelector("#cjRealtimeMessage").textContent = body;
  toast.classList.add("show");

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "./favicon.ico" });
  }

  if (navigator.vibrate) navigator.vibrate(approved ? [120, 70, 120] : [250]);
}

export function saveLastRequestId(requestId) {
  if (!requestId) return;
  localStorage.setItem(STORAGE_KEY, requestId);
  localStorage.removeItem(STATUS_KEY);
  startRealtimeRequestNotification(requestId);
}

export function startRealtimeRequestNotification(requestId = localStorage.getItem(STORAGE_KEY)) {
  if (!requestId) return () => {};

  localStorage.setItem(STORAGE_KEY, requestId);
  requestNotificationPermission();

  return onSnapshot(doc(db, "requests", requestId), (snapshot) => {
    if (!snapshot.exists()) return;
    const request = snapshot.data();
    const status = request.status || "pending";
    const previousStatus = localStorage.getItem(STATUS_KEY);

    if ((status === "approved" || status === "rejected") && status !== previousStatus) {
      notify(status, request.notice || (status === "approved" ? "신청곡이 승인되었습니다." : "신청곡이 거절되었습니다."), request);
    }

    localStorage.setItem(STATUS_KEY, status);
  }, (error) => console.error("실시간 신청 결과 확인 실패:", error));
}

startRealtimeRequestNotification();
