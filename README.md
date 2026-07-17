# cj스튜디오 Firebase 실시간 신청곡 시스템

## 포함 파일
- index.html: 이용자 회원가입/로그인/신청
- guest.html: 게스트 페이지
- admin.html: 관리자 페이지
- firebase-config.js: Firebase 연결 설정
- user-app.js / admin-app.js: Firebase 연동 코드
- firestore.rules: Firestore 보안 규칙

## Firebase Console 필수 설정

### 1. Authentication
Authentication → Sign-in method → 이메일/비밀번호를 사용 설정합니다.

### 2. Firestore 규칙
Firestore Database → 규칙 탭에서 `firestore.rules`의 내용을 붙여넣고 게시합니다.

### 3. 첫 관리자 만들기
1. 일반 이용자 페이지에서 관리자용 이메일로 회원가입합니다.
2. Firestore → users 컬렉션 → 해당 사용자 문서를 엽니다.
3. `role` 값을 `user`에서 `admin`으로 변경합니다.
4. `status` 값을 `pending`에서 `approved`로 변경합니다.
5. 그 계정으로 admin.html에 로그인합니다.

## GitHub 업로드
모든 파일을 저장소 루트에 업로드하고 Commit changes를 누릅니다.

## 주소
- 이용자: https://sokcyu.github.io/song_request/
- 게스트: https://sokcyu.github.io/song_request/guest.html
- 관리자: https://sokcyu.github.io/song_request/admin.html
