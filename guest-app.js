import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore, doc, onSnapshot, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = selector => document.querySelector(selector);

let schedule = null;
let submitting = false;
let requestUnsubs = [];

const formatDate = value => {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
};

const esc = (v="") => String(v).replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

function statusLabel(status){
  if(status === "approved") return "음원 승인";
  if(status === "rejected") return "음원 거절";
  if(status === "deleted") return "삭제 처리";
  return "승인 대기";
}

function availability() {
  if (!schedule?.start || !schedule?.end) {
    return { open: false, html: "⚪ 신청 시간이 아직 설정되지 않았습니다." };
  }

  const now = Date.now();
  const start = schedule.start.toDate().getTime();
  const end = schedule.end.toDate().getTime();

  if (now < start) {
    return { open: false, html: `🟡 신청 준비 중<br>${formatDate(schedule.start)}부터 신청할 수 있습니다.` };
  }

  if (now <= end) {
    return { open: true, html: `🟢 신청 접수 중<br>${formatDate(schedule.end)}까지 신청할 수 있습니다.` };
  }

  return { open: false, html: "🔴 신청 접수가 마감되었습니다." };
}

function renderSchedule() {
  const state = availability();
  $("#scheduleStatus").innerHTML = state.html;
  $("#submitBtn").disabled = !state.open || submitting;
}

function getItems(){
  return JSON.parse(localStorage.getItem("cj_guest_requests") || "[]");
}

function setItems(items){
  localStorage.setItem("cj_guest_requests", JSON.stringify(items.slice(0,30)));
}

function renderList(items=getItems()){
  $("#guestList").innerHTML = items.length ? items.map(x=>`
    <div class="item">
      <div class="title">${esc(x.song)}</div>
      <div class="muted">${esc(x.artist)} · ${esc(x.keyword || "")} · ${esc(x.createdAt)}</div>
      ${x.lyricsKeywords?.length ? `<div class="notice">가사 키워드: ${x.lyricsKeywords.map(esc).join(", ")}</div>` : ""}
      <span class="badge">${esc(statusLabel(x.status))}</span>
      ${x.notice ? `<div class="notice">${esc(x.notice)}</div>` : ""}
    </div>
  `).join("") : '<div class="empty">이 기기에서 신청한 곡이 없습니다.</div>';
}

function listenRequests(){
  requestUnsubs.forEach(fn=>fn());
  requestUnsubs=[];
  const items=getItems();
  renderList(items);

  items.forEach(item=>{
    if(!item.id) return;
    requestUnsubs.push(onSnapshot(doc(db,"requests",item.id),snap=>{
      const latest=getItems();
      const idx=latest.findIndex(x=>x.id===item.id);
      if(idx<0) return;

      if(snap.exists()){
        const data=snap.data();
        latest[idx]={...latest[idx],status:data.status||"pending",notice:data.notice||""};
      }else{
        latest[idx]={...latest[idx],status:"deleted",notice:"삭제 처리"};
      }
      setItems(latest);
      renderList(latest);
    },console.error));
  });
}

onSnapshot(
  doc(db, "settings", "schedule"),
  snapshot => {
    schedule = snapshot.exists() ? snapshot.data() : null;
    renderSchedule();
  },
  error => {
    console.error(error);
    $("#scheduleStatus").textContent = "신청 시간을 불러오지 못했습니다.";
    $("#submitBtn").disabled = true;
  }
);

$("#submitBtn").onclick = async () => {
  const state = availability();

  if (!state.open) {
    alert("현재는 신청 가능한 시간이 아닙니다.");
    return;
  }

  const name = $("#name").value.trim();
  const song = $("#song").value.trim();
  const artist = $("#artist").value.trim();
  const keyword = $("#keyword").value;
  const lyricsKeywordsRaw = $("#lyricsKeywords").value.trim();
  const lyricsKeywords = lyricsKeywordsRaw
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  const message = $("#message").value.trim();

  if (lyricsKeywords.length > 5) {
    alert("가사 키워드는 최대 5개까지 입력할 수 있습니다.");
    return;
  }

  if (lyricsKeywords.some(x => x.length > 20)) {
    alert("가사 키워드 하나는 20자 이하로 입력하세요.");
    return;
  }

  if (!name || !song || !artist || !keyword) {
    alert("이름, 노래 제목, 가수, 음악 키워드를 모두 입력하세요.");
    return;
  }

  submitting = true;
  renderSchedule();

  try {
    const ref = await addDoc(collection(db, "requests"), {
      type: "guest",
      name,
      song,
      artist,
      keyword,
      lyricsKeywords,
      message,
      status: "pending",
      notice: "승인 대기",
      createdAt: serverTimestamp()
    });

    const items=getItems();
    items.unshift({
      id:ref.id,
      song,
      artist,
      keyword,
      lyricsKeywords,
      status:"pending",
      notice:"승인 대기",
      createdAt:new Date().toLocaleString("ko-KR")
    });
    setItems(items);

    $("#song").value = "";
    $("#artist").value = "";
    $("#lyricsKeywords").value = "";
    $("#message").value = "";
    listenRequests();
    alert("게스트 신청이 접수되었습니다.");
  } catch (error) {
    console.error(error);
    alert("신청을 저장하지 못했습니다. Firestore 규칙을 확인하세요.");
  } finally {
    submitting = false;
    renderSchedule();
  }
};

listenRequests();
setInterval(renderSchedule, 1000);
