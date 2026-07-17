# CJ스튜디오 비로그인 게스트 신청

## 기능
- 회원가입·로그인 없이 신청
- 닉네임, 노래 제목, 가수 입력
- 예약시간에만 신청 가능
- Firestore requests 컬렉션에 type: guest로 저장
- 게스트는 신청 목록을 읽거나 수정할 수 없음

## GitHub 업로드 파일
- guest.html
- guest-app.js
- guest-style.css
- firebase-config.js

## Firestore 규칙
`firestore-guest.rules`는 게스트 기능에 필요한 예시 규칙입니다.
기존 관리자·이용자 규칙과 합쳐서 사용해야 합니다.
이 파일로 전체 규칙을 그대로 교체하면 관리자 기능이 막힐 수 있습니다.

## 접속 주소
https://sokcyu.github.io/song_request/guest.html
