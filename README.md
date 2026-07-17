# CJ스튜디오 새 관리자 프로그램

## 포함 파일
- admin.html
- admin-app.js
- admin-style.css
- firebase-config.js
- firestore.rules

## 관리자 권한 설정
Firebase Authentication에 계정을 만든 뒤 Firestore의 `users/{uid}` 문서에 아래 필드를 설정하세요.

- name: 관리자 이름
- email: 관리자 이메일
- role: admin
- status: approved

## Firebase Authentication 설정
- Email/Password 사용 설정
- Google 사용 설정
- 승인된 도메인에 `sokcyu.github.io` 추가 확인

## Firestore 규칙
Firestore Database → 규칙 탭에서 `firestore.rules` 내용을 붙여넣고 게시하세요.

## GitHub 업로드
모든 파일을 저장소 루트에 업로드합니다.
관리자 주소:
https://sokcyu.github.io/song_request/admin.html
