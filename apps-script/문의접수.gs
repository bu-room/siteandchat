/**
 * 와방 · 손님 문의 자동 접수 (구글 Apps Script)
 *
 * 매물 사이트에서 손님이 '중개사에게 바로 전송'을 누르면
 *   1) 구글 시트 '문의접수' 탭에 한 줄씩 기록되고
 *   2) 중개사 이메일로 알림이 갑니다 (휴대폰 Gmail 앱 알림으로 바로 확인)
 *
 * [설치 방법]
 * 1. 매물 구글 시트 열기 → 확장 프로그램 → Apps Script
 * 2. 이 코드 전체를 붙여넣고, 아래 AGENT_EMAIL 을 본인 메일로 바꾸고 저장
 * 3. 오른쪽 위 '배포' → '새 배포' → 유형: 웹 앱
 *      - 실행 사용자: 나
 *      - 액세스 권한: 모든 사용자
 *    → 배포 (처음엔 권한 허용 창이 뜹니다: 내 계정 선택 → 고급 → 이동 → 허용)
 * 4. 나오는 '웹 앱 URL'(https://script.google.com/macros/s/....../exec)을 복사해서
 *    매물 사이트 index.html 의 CONFIG.INQUIRY_URL 에 붙여넣기
 *
 * ※ 코드를 고친 뒤에는 '배포 관리 → 수정(연필) → 버전: 새 버전 → 배포' 를 해야 반영됩니다.
 */

const AGENT_EMAIL = "여기에_중개사_메일@gmail.com";   // 알림 받을 메일
const SHEET_NAME  = "문의접수";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || "{}");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) {
      sh = ss.insertSheet(SHEET_NAME);
      sh.appendRow(["접수시간", "성함", "연락처", "매물번호", "선택 매물", "희망 구조", "보증금", "월세", "위치", "반려동물", "방 볼 수 있는 날", "전체 내용", "처리상태"]);
      sh.setFrozenRows(1);
    }
    const items = d.items || [];
    const c = d.chat || {};
    const clean = v => String(v == null ? "" : v).replace(/^[=+\-@]/, "'$&"); // 수식 주입 방지

    sh.appendRow([
      new Date(),
      clean(d.name), clean(d.phone),
      items.map(x => x.id).join(", "),
      items.map(x => `#${x.id} ${x.type} ${x.area} ${x.price}`).join("\n"),
      clean(c.structure), clean(c.deposit), clean(c.monthlyRent), clean(c.location), clean(c.pet), clean(c.viewingDate),
      clean(d.message),
      "신규"
    ]);

    const subject = `[와방 문의] ${d.name || "손님"} ${d.phone || ""} · 매물 ${items.length}개`;
    MailApp.sendEmail(AGENT_EMAIL, subject, String(d.message || ""));

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// 브라우저로 웹앱 주소를 열었을 때 작동 확인용
function doGet() {
  return ContentService.createTextOutput("와방 문의 접수 서버가 작동 중입니다.");
}
