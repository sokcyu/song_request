import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=s=>document.querySelector(s);
let profile=null, scheduleData=null, unsubReq=null, unsubSchedule=null;
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmt=v=>new Intl.DateTimeFormat("ko-KR",{dateStyle:"short",timeStyle:"short"}).format(v?.toDate?v.toDate():new Date(v));
const error=e=>alert(e?.message||String(e));

function availability(){
 if(!scheduleData?.start||!scheduleData?.end)return{open:false,text:"⚪ 신청 시간이 설정되지 않았습니다."};
 const n=Date.now(),s=scheduleData.start.toDate().getTime(),e=scheduleData.end.toDate().getTime();
 if(n<s)return{open:false,text:`🟡 접수 준비 중<br><span class="muted">${fmt(scheduleData.start)}부터 신청 가능합니다.</span>`};
 if(n<=e)return{open:true,text:`🟢 접수 중<br><span class="muted">${fmt(scheduleData.end)}까지 신청 가능합니다.</span>`};
 return{open:false,text:"🔴 신청 접수가 마감되었습니다."};
}
function renderTime(){const a=availability();$("#timeStatus").innerHTML=a.text;$("#addBtn").disabled=!a.open}
function reset(){["#authArea","#pendingArea","#app"].forEach(x=>$(x).classList.add("hidden"))}

$("#joinBtn").onclick=async()=>{
 const name=$("#joinName").value.trim(),email=$("#joinEmail").value.trim(),pw=$("#joinPw").value;
 if(name.length<2||pw.length<6){alert("이름 2자 이상, 비밀번호 6자 이상 입력하세요.");return}
 try{
  const c=await createUserWithEmailAndPassword(auth,email,pw);
  await setDoc(doc(db,"users",c.user.uid),{name,email,status:"pending",role:"user",createdAt:serverTimestamp()});
  alert("가입 신청 완료. 관리자 승인을 기다려 주세요.");
 }catch(e){error(e)}
};
$("#loginBtn").onclick=()=>signInWithEmailAndPassword(auth,$("#loginEmail").value.trim(),$("#loginPw").value).catch(error);
$("#logoutBtn").onclick=$("#pendingLogout").onclick=()=>signOut(auth);

$("#addBtn").onclick=async()=>{
 if(!auth.currentUser||profile?.status!=="approved"){alert("관리자 승인이 필요합니다.");return}
 if(!availability().open){alert("현재 신청 시간이 아닙니다.");return}
 const song=$("#song").value.trim(),artist=$("#artist").value.trim(),keyword=$("#keyword").value;
 if(!song||!artist){alert("노래 제목과 가수를 입력하세요.");return}
 try{
  await addDoc(collection(db,"requests"),{userId:auth.currentUser.uid,userEmail:auth.currentUser.email,name:profile.name,song,artist,keyword,status:"pending",notice:"신청이 접수되었습니다. 관리자 확인을 기다려 주세요.",createdAt:serverTimestamp()});
  $("#song").value="";$("#artist").value="";alert("신청되었습니다.");
 }catch(e){error(e)}
};

onAuthStateChanged(auth,async user=>{
 reset(); if(unsubReq)unsubReq(); if(unsubSchedule)unsubSchedule();
 if(!user){$("#authArea").classList.remove("hidden");return}
 try{
  const ps=await getDoc(doc(db,"users",user.uid));
  if(!ps.exists())throw new Error("이용자 정보가 없습니다.");
  profile=ps.data();
  if(profile.status==="pending"){$("#pendingArea").classList.remove("hidden");return}
  if(profile.status!=="approved"){alert("정지되었거나 승인되지 않은 계정입니다.");await signOut(auth);return}
  $("#app").classList.remove("hidden");$("#welcome").textContent=`${profile.name}님`;
  unsubSchedule=onSnapshot(doc(db,"settings","schedule"),s=>{scheduleData=s.exists()?s.data():null;renderTime()});
  const q=query(collection(db,"requests"),where("userId","==",user.uid));
  unsubReq=onSnapshot(q,s=>{
   const arr=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
   $("#list").innerHTML=arr.length?arr.map(x=>`<div class="item"><div class="song">${esc(x.song)}</div><div class="muted">${esc(x.artist)} · ${x.createdAt?fmt(x.createdAt):""}</div><span class="badge">${esc(x.status)}</span>${x.notice?`<div class="notice">📢 ${esc(x.notice)}</div>`:""}</div>`).join(""):'<div class="empty">신청곡이 없습니다.</div>';
  },error);
 }catch(e){error(e);await signOut(auth)}
});
setInterval(renderTime,1000);
