import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, deleteDoc, setDoc,
  collection, onSnapshot, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=s=>document.querySelector(s);
const esc=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const fmt=v=>new Intl.DateTimeFormat("ko-KR",{dateStyle:"short",timeStyle:"short"}).format(v?.toDate?v.toDate():new Date(v));
const local=v=>{const d=new Date(v),z=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`};
const error=e=>alert(e?.message||String(e));
let unsubUsers=null,unsubRequests=null,unsubSchedule=null;

function resetViews(){
  $("#authArea").classList.add("hidden");
  $("#pendingArea").classList.add("hidden");
  $("#app").classList.add("hidden");
}

$("#joinBtn").onclick=async()=>{
  const name=$("#joinName").value.trim();
  const email=$("#joinEmail").value.trim();
  const password=$("#joinPw").value;

  if(name.length<2){
    alert("관리자 이름을 2자 이상 입력하세요.");
    return;
  }
  if(password.length<6){
    alert("비밀번호는 6자 이상 입력하세요.");
    return;
  }

  try{
    const credential=await createUserWithEmailAndPassword(auth,email,password);
    await setDoc(doc(db,"users",credential.user.uid),{
      name,
      email,
      role:"admin-request",
      status:"pending",
      createdAt:serverTimestamp()
    });
    alert("관리자 가입 신청이 완료되었습니다. 기존 관리자의 승인을 기다려 주세요.");
  }catch(e){error(e)}
};

$("#loginBtn").onclick=()=>signInWithEmailAndPassword(
  auth,$("#email").value.trim(),$("#pw").value
).catch(error);

$("#logoutBtn").onclick=$("#pendingLogout").onclick=()=>signOut(auth);

window.approveUser=async(id,requestedRole)=>{
  try{
    const role=requestedRole==="admin-request"?"admin":"user";
    await updateDoc(doc(db,"users",id),{role,status:"approved"});
  }catch(e){error(e)}
};

window.suspendUser=async id=>{
  try{await updateDoc(doc(db,"users",id),{status:"suspended"})}
  catch(e){error(e)}
};

window.deleteUser=async id=>{
  if(confirm("프로필을 삭제할까요? Firebase Authentication 계정은 콘솔에서 별도 삭제해야 합니다.")){
    try{await deleteDoc(doc(db,"users",id))}
    catch(e){error(e)}
  }
};

window.updateRequest=async(id,status)=>{
  try{
    const ref=doc(db,"requests",id),s=await getDoc(ref);
    if(!s.exists()||s.data().status!=="pending"){
      alert("이미 처리된 신청입니다.");
      return;
    }
    const notice=status==="approved"
      ?"승인되었습니다. 음원 발매 이후 공고문을 발송하겠습니다."
      :"거절되었습니다. 다른 음원을 말씀해 주세요.";
    await updateDoc(ref,{status,notice,updatedAt:serverTimestamp()});
  }catch(e){error(e)}
};

window.deleteRequest=async id=>{
  if(confirm("삭제 처리할까요?")){
    try{
      await updateDoc(doc(db,"requests",id),{
        status:"deleted",
        notice:"음원이 부적절함으로 처리되어 삭제되었습니다. 다시 이용해 주시길 바랍니다.",
        updatedAt:serverTimestamp()
      });
    }catch(e){error(e)}
  }
};

window.youtube=(song,artist)=>window.open(
  "https://www.youtube.com/results?search_query="+encodeURIComponent(artist+" "+song),"_blank"
);

$("#saveTime").onclick=async()=>{
  const s=$("#start").value,e=$("#end").value;
  if(!s||!e||new Date(e)<=new Date(s)){
    alert("올바른 시간을 입력하세요.");
    return;
  }
  try{
    await setDoc(doc(db,"settings","schedule"),{
      start:Timestamp.fromDate(new Date(s)),
      end:Timestamp.fromDate(new Date(e)),
      updatedAt:serverTimestamp()
    });
  }catch(x){error(x)}
};

$("#openNow").onclick=()=>{
  const n=new Date(),e=new Date(n.getTime()+3600000);
  $("#start").value=local(n);
  $("#end").value=local(e);
  $("#saveTime").click();
};

$("#closeNow").onclick=()=>{
  const n=new Date(),s=new Date(n.getTime()-60000);
  $("#start").value=local(s);
  $("#end").value=local(n);
  $("#saveTime").click();
};

onAuthStateChanged(auth,async user=>{
  if(unsubUsers)unsubUsers();
  if(unsubRequests)unsubRequests();
  if(unsubSchedule)unsubSchedule();

  resetViews();

  if(!user){
    $("#authArea").classList.remove("hidden");
    return;
  }

  try{
    const profileSnap=await getDoc(doc(db,"users",user.uid));
    if(!profileSnap.exists()){
      throw new Error("관리자 프로필이 없습니다.");
    }

    const profile=profileSnap.data();

    if(profile.role==="admin-request" || profile.status==="pending"){
      $("#pendingArea").classList.remove("hidden");
      return;
    }

    if(profile.role!=="admin" || profile.status!=="approved"){
      alert("관리자 권한이 없거나 정지된 계정입니다.");
      await signOut(auth);
      return;
    }

    $("#app").classList.remove("hidden");

    unsubUsers=onSnapshot(collection(db,"users"),s=>{
      const a=s.docs.map(d=>({id:d.id,...d.data()}));
      $("#users").innerHTML=a.length?a.map(u=>`
        <div class="item">
          <div class="song">${esc(u.name||u.email)}</div>
          <div class="muted">${esc(u.email||"")} · 역할: ${esc(u.role||"user")}</div>
          <span class="badge">${esc(u.status||"pending")}</span>
          <div class="actions">
            <button class="ok" onclick="approveUser('${u.id}','${esc(u.role||"user")}')">
              ${u.role==="admin-request"?"✅ 관리자 승인":"✅ 이용 승인"}
            </button>
            <button class="no" onclick="suspendUser('${u.id}')">⛔ 정지</button>
            <button class="del" onclick="deleteUser('${u.id}')">🗑 프로필 삭제</button>
          </div>
        </div>`).join("")
        :'<div class="empty">계정이 없습니다.</div>';
    },error);

    unsubRequests=onSnapshot(collection(db,"requests"),s=>{
      const a=s.docs.map(d=>({id:d.id,...d.data()}))
        .sort((x,y)=>(y.createdAt?.seconds||0)-(x.createdAt?.seconds||0));

      $("#requests").innerHTML=a.length?a.map(x=>`
        <div class="item">
          <div class="song">${esc(x.song)}</div>
          <div class="muted">${esc(x.artist)} · ${esc(x.name)} · ${x.createdAt?fmt(x.createdAt):""}</div>
          <span class="badge">${esc(x.status)}</span>
          ${x.notice?`<div class="notice">📢 ${esc(x.notice)}</div>`:""}
          <div class="actions">
            <button class="ok" onclick="updateRequest('${x.id}','approved')" ${x.status!=="pending"?"disabled":""}>✅ 승인</button>
            <button class="no" onclick="updateRequest('${x.id}','rejected')" ${x.status!=="pending"?"disabled":""}>❌ 거절</button>
            <button class="yt" onclick="youtube('${esc(x.song)}','${esc(x.artist)}')">▶ 유튜브</button>
            <button class="del" onclick="deleteRequest('${x.id}')">🗑 삭제 처리</button>
          </div>
        </div>`).join("")
        :'<div class="empty">신청곡이 없습니다.</div>';
    },error);

    unsubSchedule=onSnapshot(doc(db,"settings","schedule"),s=>{
      if(!s.exists()){
        $("#scheduleStatus").textContent="예약시간 없음";
        return;
      }
      const d=s.data();
      $("#start").value=local(d.start.toDate());
      $("#end").value=local(d.end.toDate());
      $("#scheduleStatus").textContent=`${fmt(d.start)} ~ ${fmt(d.end)}`;
    },error);

  }catch(e){
    error(e);
    await signOut(auth);
  }
});
