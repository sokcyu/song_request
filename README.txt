CJ스튜디오 관리자 + 실시간 승인/거절 알림 업데이트

추가 기능
1. 신청곡 승인 / 거절 / 완전 삭제
2. 승인된 음원 유튜브 사운드 확인
3. 관리자 새 신청 브라우저 실시간 알림
4. 신청자 승인·거절 실시간 화면 알림
5. 승인·거절 처리 내역을 requestNotifications 컬렉션에도 저장

적용 파일
- admin-app.js: 기존 관리자 파일에 덮어쓰기
- admin-style.css: 기존 CSS에 덮어쓰기
- realtime-notification.js: 신청자 페이지와 같은 폴더에 새로 업로드

신청자 페이지 연결 방법
1. 신청자 페이지 HTML의 </body> 바로 위에 아래 코드를 추가합니다.

<script type="module" src="./realtime-notification.js"></script>

2. 신청이 Firestore에 정상 저장된 직후 생성된 문서 ID를 저장합니다.

import { saveLastRequestId } from "./realtime-notification.js";

const saved = await addDoc(collection(db, "requests"), requestData);
saveLastRequestId(saved.id);

이미 신청 문서 ID를 변수로 가지고 있다면 saveLastRequestId(문서ID)만 실행하면 됩니다.

작동 방식
- 관리자가 승인 또는 거절을 누르면 requests/{문서ID}의 status와 notice가 즉시 변경됩니다.
- 신청자 브라우저는 해당 문서를 onSnapshot으로 감시합니다.
- 상태가 approved 또는 rejected로 바뀌면 토스트, 브라우저 알림, 진동이 즉시 실행됩니다.
- 브라우저 알림 권한이 거부되어도 화면 토스트 알림은 계속 작동합니다.

주의
- 신청자의 브라우저 localStorage에 마지막 신청 문서 ID가 저장되어야 합니다.
- Firestore 보안 규칙에서 신청자가 자신의 requests 문서를 읽을 수 있어야 합니다.
- HTTPS인 GitHub Pages에서 브라우저 알림이 정상 작동합니다.
