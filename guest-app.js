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

const formatDate = value => {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
};

function availability() {
  if (!schedule?.start || !schedule?.end) {
    return {
      open: false,
      html: "⚪ 신청 시간이 아직 설정되지 않았습니다."
    };
  }

  const now = Date.now();
  const start = schedule.start.toDate().getTime();
  const end = schedule.end.toDate().getTime();

  if (now < start) {
    return {
      open: false,
      html: `🟡 신청 준비 중<br>${formatDate(schedule.start)}부터 신청할 수 있습니다.`
    };
  }

  if (now <= end) {
    return {
      open: true,
      html: `🟢 신청 접수 중<br>${formatDate(schedule.end)}까지 신청할 수 있습니다.`
    };
  }

  return {
    open: false,
    html: "🔴 신청 접수가 마감되었습니다."
  };
}

function renderSchedule() {
  const state = availability();
  $("#scheduleStatus").innerHTML = state.html;
  $("#submitBtn").disabled = !state.open || submitting;
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
  const message = $("#message").value.trim();

  if (!name || !song || !artist) {
    alert("이름, 노래 제목, 가수를 모두 입력하세요.");
    return;
  }

  submitting = true;
  renderSchedule();

  try {
    await addDoc(collection(db, "requests"), {
      type: "guest",
      name,
      song,
      artist,
      keyword,
      message,
      status: "pending",
      notice: "게스트 신청이 접수되었습니다.",
      createdAt: serverTimestamp()
    });

    $("#song").value = "";
    $("#artist").value = "";
    $("#message").value = "";
    alert("게스트 신청이 접수되었습니다.");
  } catch (error) {
    console.error(error);
    alert("신청을 저장하지 못했습니다. Firestore 규칙을 확인하세요.");
  } finally {
    submitting = false;
    renderSchedule();
  }
};

setInterval(renderSchedule, 1000);
