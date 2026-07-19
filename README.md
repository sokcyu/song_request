# CJ Studio 승인된 회원만 신청 버전

- 관리자 승인을 받은 등록 회원만 음원 신청 가능
- 이용자 및 구독자 역할 지원
- 로그인 시 회원 상태와 역할 확인
- 신청 시 Firestore 회원 상태를 다시 확인
- 미등록/승인 대기/거절/삭제 계정은 신청 차단
- 관리자가 회원을 이용자 또는 구독자로 지정 가능

주의: 현재는 정적 GitHub Pages와 공개 Firestore 규칙 구조입니다.
강한 보안을 위해서는 Firebase Authentication 기반 규칙을 권장합니다.

적용: ZIP의 모든 파일을 GitHub 저장소 루트에 업로드하고 Commit changes를 누르세요.
