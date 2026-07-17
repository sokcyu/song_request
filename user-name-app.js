import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore, doc, onSnapshot, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = s => document.querySelector(s);

let currentName = localStorage.getItem("cj_simple_user_name") || "";
let schedule = null;
let submitting = false;

const fmt = value => {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle:"short", timeStyle:"short"
  }).format(date);
};

const esc = (v="") => String(v).replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

function availability(){
  if(!schedule?.start || !schedule?.end){
    return {open:false,text:"⚪ 신청 시간이 아직 설정되지 않았습니다."};
  }
  const now=Date.now(), start=schedule.start.toDate().getTime(), end=schedule.end.toDate().getTime();
  if(now<start)return {open:false,text:`🟡 접수 준비 중<br>${fmt(schedule.start)}부터 신청할 수 있습니다.`};
  if(now<=end)return {open:true,text:`🟢 신청 접수 중<br>${fmt(schedule.end)}까지 신청할 수 있습니다.`};
  return {open:false,text:"🔴 신청 접수가 마감되었습니다."};
}

function renderSchedule(){
  const state=availability();
  $("#scheduleStatus").innerHTML=state.text;
  $("#submitButton").disabled=!state.open || submitting;
}

function renderMyList(){
  const items = JSON.parse(localStorage.getItem("cj_simple_user_requests") || "[]");
  $("#myList").innerHTML = items.length ? items.map(x=>`
    <div class="item">
      <div class="title">${esc(x.song)}</div>
      <div class="muted">${esc(x.artist)} · ${esc(x.createdAt)}</div>
      <span class="badge">신청 완료</span>
    </div>
  `).join("") : '<div class="empty">이 기기에서 신청한 곡이 없습니다.</div>';
}

function openApp(){
  $("#nameView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#welcome").textContent = `${currentName}님`;
  renderMyList();
}

$("#startButton").onclick=()=>{
  const name=$("#nameInput").value.trim();
  if(name.length<2){
    alert("이름 또는 닉네임을 2자 이상 입력하세요.");
    return;
  }
  currentName=name;
  localStorage.setItem("cj_simple_user_name",name);
  openApp();
};

$("#changeName").onclick=()=>{
  localStorage.removeItem("cj_simple_user_name");
  currentName="";
  $("#appView").classList.add("hidden");
  $("#nameView").classList.remove("hidden");
  $("#nameInput").value="";
};

$("#submitButton").onclick=async()=>{
  const state=availability();
  if(!state.open){
    alert("현재는 신청 가능한 시간이 아닙니다.");
    return;
  }

  const song=$("#song").value.trim();
  const artist=$("#artist").value.trim();
  const keyword=$("#keyword").value;
  const message=$("#message").value.trim();

  if(!song || !artist){
    alert("노래 제목과 가수를 입력하세요.");
    return;
  }

  submitting=true;
  renderSchedule();

  try{
    await addDoc(collection(db,"requests"),{
      type:"simple-user",
      name:currentName,
      song,
      artist,
      keyword,
      message,
      status:"pending",
      notice:"신청이 접수되었습니다.",
      createdAt:serverTimestamp()
    });

    const localItems=JSON.parse(localStorage.getItem("cj_simple_user_requests") || "[]");
    localItems.unshift({
      song,
      artist,
      createdAt:new Date().toLocaleString("ko-KR")
    });
    localStorage.setItem("cj_simple_user_requests",JSON.stringify(localItems.slice(0,30)));

    $("#song").value="";
    $("#artist").value="";
    $("#message").value="";
    renderMyList();
    alert("신청되었습니다.");
  }catch(error){
    console.error(error);
    alert("신청 저장에 실패했습니다. Firestore 규칙을 확인하세요.");
  }finally{
    submitting=false;
    renderSchedule();
  }
};

onSnapshot(doc(db,"settings","schedule"),snap=>{
  schedule=snap.exists()?snap.data():null;
  renderSchedule();
},error=>{
  console.error(error);
  $("#scheduleStatus").textContent="신청 시간을 불러오지 못했습니다.";
});

setInterval(renderSchedule,1000);

if(currentName){
  openApp();
}
