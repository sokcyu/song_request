CJ스튜디오 관리자 제작 상태 기능 추가본

추가 기능
1. 제작 대기
2. 제작 완료
3. 제작 취소
4. 신청곡 상태별 필터
5. 상태 변경 확인창
6. Firestore requests 문서의 status, notice, updatedAt 자동 갱신

적용 방법
1. ZIP 압축을 풉니다.
2. admin-app.js, admin.html, admin-style.css를 GitHub 저장소 루트에 업로드합니다.
3. 기존 파일이 있으면 덮어씁니다.
4. Commit changes를 누릅니다.
5. 잠시 후 관리자 페이지를 새로고침합니다.

상태 값
production_pending = 제작 대기
production_completed = 제작 완료
production_cancelled = 제작 취소
