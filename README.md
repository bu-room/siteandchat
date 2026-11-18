# 와방 · 매물 사이트 + 매물 접수 챗봇

- 매물 사이트: https://bu-room.github.io/siteandchat/
- 챗봇: https://bu-room.github.io/siteandchat/chat/

흐름: 챗봇 조건 접수 → `?chat=` 으로 매물 사이트에 조건 자동 적용 → 손님이 ♡ 담기 → 중개사에게 보내기 (카톡/문자/인스타, 또는 Apps Script 자동 전송)

자동 전송 설정(카카오톡 알림): `apps-script/문의접수.gs` 맨 위 설치 순서대로 카카오 개발자 앱 + Apps Script 배포 후, `index.html` 의 `CONFIG.INQUIRY_URL` 에 웹앱 주소 입력. 문의가 오면 중개사 카톡 "나와의 채팅"으로 자동 발송 + 시트 "문의접수" 탭 기록.
