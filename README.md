# 와방 · 매물 사이트 + 매물 접수 챗봇

- 매물 사이트: https://bu-room.github.io/siteandchat/
- 챗봇: https://bu-room.github.io/siteandchat/chat/

흐름: 챗봇 조건 접수 → `?chat=` 으로 매물 사이트에 조건 자동 적용 → 손님이 ♡ 담기 → 중개사에게 보내기 (카톡/문자/인스타, 또는 Apps Script 자동 전송)

자동 전송 설정: `apps-script/문의접수.gs` 를 구글 시트 Apps Script에 배포 후 `index.html` 의 `CONFIG.INQUIRY_URL` 에 웹앱 주소 입력.
