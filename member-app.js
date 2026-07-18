import{firebaseConfig}from"./firebase-config.js";import{initializeApp}from"https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";import{getFirestore,doc,getDoc,setDoc,onSnapshot,collection,addDoc,deleteDoc,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
const db=getFirestore(initializeApp(firebaseConfig)),$=s=>document.querySelector(s);let user=null,schedule=null,unsubs=[];
const hash=async t=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t)))].map(b=>b.toString(16).padStart(2,"0")).join("");
const id=v=>v.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
const msg=t=>{$("#authMsg").textContent=t;$("#authMsg").classList.remove("hidden")};
$("#regBtn").onclick=async()=>{let n=$("#name").value.trim(),i=id($("#regId").value),p=$("#regPw").value;if(n.length<2||i.length<4||p.length<6)return msg("이름 2자, 아이디 4자, 비밀번호 6자 이상 입력하세요.");let r=doc(db,"members",i);if((await getDoc(r)).exists())return msg("이미 존재하는 아이디입니다.");await setDoc(r,{name:n,memberId:i,passwordHash:await hash(p),phone:$("#phone").value.trim(),email:$("#email").value.trim(),status:"pending",createdAt:serverTimestamp()});msg("가입 요청 완료. 관리자 승인 후 로그인하세요.")};
$("#loginBtn").onclick=async()=>{let i=id($("#loginId").value),s=await getDoc(doc(db,"members",i));if(!s.exists())return msg("등록되지 않은 아이디입니다.");let d=s.data();if(await hash($("#loginPw").value)!==d.passwordHash)return msg("비밀번호가 올바르지 않습니다.");if(d.status==="pending")return msg("관리자 승인 대기 중입니다.");if(d.status==="rejected")return msg("회원가입이 거절되었습니다.");if(d.status!=="approved")return msg("이용할 수 없는 상태입니다.");user={id:i,...d};localStorage.setItem("cj_member",i);open()};
function open(){$("#auth").classList.add("hidden");$("#app").classList.remove("hidden");$("#welcome").textContent=user.name+"님";$("#memberId").textContent="회원 아이디: "+user.id;listen()}
$("#logout").onclick=()=>{localStorage.removeItem("cj_member");location.reload()};
$("#mode").onchange=()=>{let l=$("#mode").value==="lyrics";$("#song").disabled=l;$("#artist").disabled=l;if(l){$("#song").value="";$("#artist").value=""}};
function can(){if(!schedule)return false;let n=Date.now(),a=schedule.start.toDate().getTime(),b=schedule.end.toDate().getTime();$("#schedule").textContent=n<a?"접수 전":n>b?"접수 마감":"접수 중";$("#submit").disabled=!(n>=a&&n<=b);return n>=a&&n<=b}
onSnapshot(doc(db,"settings","schedule"),s=>{schedule=s.exists()?s.data():null;can()});
$("#submit").onclick=async()=>{if(!can())return alert("현재 신청 시간이 아닙니다.");let m=$("#mode").value,g=$("#genre").value,k=$("#lyrics").value.split(",").map(x=>x.trim()).filter(Boolean),song=$("#song").value.trim(),artist=$("#artist").value.trim();if(!g)return alert("장르를 선택하세요.");if(m==="song"&&(!song||!artist))return alert("제목과 가수를 입력하세요.");if(m==="lyrics"&&!k.length)return alert("가사 키워드를 입력하세요.");if(k.length>5)return alert("가사 키워드는 최대 5개입니다.");let r=await addDoc(collection(db,"requests"),{type:"member",memberId:user.id,name:user.name,requestMode:m,song:m==="lyrics"?"":song,artist:m==="lyrics"?"":artist,genre:g,lyricsKeywords:k,message:$("#message").value.trim(),status:"pending",notice:"승인 대기",createdAt:serverTimestamp()});let a=JSON.parse(localStorage.getItem("req_"+user.id)||"[]");a.unshift({id:r.id,requestMode:m,song:m==="lyrics"?"가사 키워드 신청":song,artist:m==="lyrics"?"제목·가수 미입력":artist,genre:g,lyricsKeywords:k,status:"pending"});localStorage.setItem("req_"+user.id,JSON.stringify(a));listen()};
function listen(){unsubs.forEach(f=>f());unsubs=[];let a=JSON.parse(localStorage.getItem("req_"+user.id)||"[]");const render=()=>$("#myList").innerHTML=a.length?a.map(x=>`<div class="item"><b>${x.requestMode==="lyrics"?"가사 키워드 신청":x.song}</b><div class="muted">${x.artist} · ${x.genre}</div><div class="notice">${x.lyricsKeywords?.join(", ")||""}</div><span class="badge">${x.status==="approved"?"음원 승인":x.status==="rejected"?"음원 거절":"승인 대기"}</span><button class="delete" onclick="deleteMemberRequest(\'${x.id}\')">🗑 신청 내역 삭제</button></div>`).join(""):'<div class="empty">신청곡이 없습니다.</div>';render();a.forEach(x=>unsubs.push(onSnapshot(doc(db,"requests",x.id),s=>{if(s.exists()){let d=s.data();x.status=d.status;x.notice=d.notice}else{a=a.filter(v=>v.id!==x.id)}localStorage.setItem("req_"+user.id,JSON.stringify(a));render()})))}
(async()=>{let i=localStorage.getItem("cj_member");if(i){let s=await getDoc(doc(db,"members",i));if(s.exists()&&s.data().status==="approved"){user={id:i,...s.data()};open()}}})();
window.deleteMemberRequest=async requestId=>{
  if(!confirm("이 신청 내역을 삭제하시겠습니까?\n삭제 후 복구할 수 없습니다."))return;
  try{
    await deleteDoc(doc(db,"requests",requestId));
    let items=JSON.parse(localStorage.getItem("req_"+user.id)||"[]");
    items=items.filter(x=>x.id!==requestId);
    localStorage.setItem("req_"+user.id,JSON.stringify(items));
    listen();
    alert("신청 내역이 삭제되었습니다.");
  }catch(error){
    console.error(error);
    alert("신청 내역을 삭제하지 못했습니다.");
  }
};
