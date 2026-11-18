/**
 * 와방 · 손님 문의 자동 접수 → 중개사 카카오톡으로 알림 (구글 Apps Script)
 *
 * 손님이 매물 사이트에서 '중개사에게 바로 전송'을 누르면
 *   1) 구글 시트 '문의접수' 탭에 한 줄 기록
 *   2) 중개사 본인 카카오톡 '나와의 채팅'으로 문의 내용이 자동 발송 (카톡 알림 울림)
 *
 * ※ 오픈카톡방에 자동으로 글을 올리는 기능은 카카오가 제공하지 않아서,
 *    카카오 공식 '나에게 보내기' API를 사용합니다. (무료)
 *
 * ───────── 설치 순서 (처음 한 번만) ─────────
 * [A] 카카오 개발자 앱 만들기  https://developers.kakao.com
 *   1. 로그인 → 내 애플리케이션 → 애플리케이션 추가 (이름 예: 와방 알림)
 *   2. 앱 키 → 'REST API 키' 복사 → 아래 KAKAO_REST_API_KEY 에 붙여넣기
 *   3. 카카오 로그인 → 활성화 ON
 *   4. 카카오 로그인 → 동의항목 → '카카오톡 메시지 전송(talk_message)' → 선택 동의로 설정
 *   5. 플랫폼(또는 제품 링크 관리) → Web 사이트 도메인에  https://bu-room.github.io  등록
 *   6. (보안 → Client Secret 이 '사용함'이면 코드 값을 아래 KAKAO_CLIENT_SECRET 에 붙여넣기)
 *
 * [B] 이 스크립트 배포
 *   1. 매물 구글 시트 → 확장 프로그램 → Apps Script → 이 코드 전체 붙여넣기 → 저장
 *   2. 위쪽 함수 선택 칸에서 '설치하기' 선택 → 실행 → 권한 허용
 *      (내 계정 선택 → 고급 → 안전하지 않음으로 이동 → 허용)
 *   3. 배포 → 새 배포 → 유형: 웹 앱 / 실행 사용자: 나 / 액세스 권한: 모든 사용자 → 배포
 *   4. '웹 앱 URL'(…/exec) 복사
 *
 * [C] 연결
 *   1. 카카오 개발자 앱 → 카카오 로그인 → Redirect URI 에 위 웹 앱 URL 그대로 등록
 *   2. 브라우저(휴대폰 OK)에서  웹앱URL?setup=1  열기 → '카카오톡 연결하기' → 로그인·동의
 *      → "연결 완료" + 카톡으로 테스트 메시지가 오면 성공
 *   3. 매물 사이트 index.html 의 CONFIG.INQUIRY_URL 에 웹 앱 URL 붙여넣기
 *
 * ※ 코드를 고친 뒤에는 '배포 관리 → 수정(연필) → 버전: 새 버전 → 배포' (주소 그대로 유지됨)
 * ※ 연결은 매일 자동으로 갱신되므로 다시 할 필요가 없습니다. (오래 안 쓰거나 카카오에서
 *    연결을 끊었을 때만 ?setup=1 로 다시 연결)
 */

const KAKAO_REST_API_KEY  = "여기에_REST_API_키";
const KAKAO_CLIENT_SECRET = "";                                   // 사용 안 하면 비워두기
const LINK_URL            = "https://bu-room.github.io/siteandchat/"; // 카톡 메시지 버튼 링크 (위 5번에 등록한 도메인)
const SEND_EMAIL_TOO      = false;                                // 메일도 같이 받고 싶으면 true
const AGENT_EMAIL         = "";                                   // SEND_EMAIL_TOO 가 true 일 때 받을 메일
const SHEET_NAME          = "문의접수";

const PROPS = PropertiesService.getScriptProperties();

/* ===================== 손님 문의 받기 ===================== */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const items = d.items || [];
    const c = d.chat || {};
    const clean = v => String(v == null ? "" : v).replace(/^[=+\-@]/, "'$&"); // 시트 수식 주입 방지

    const sh = getSheet_();
    sh.appendRow([
      new Date(), clean(d.name), clean(d.phone),
      items.map(x => x.id).join(", "),
      items.map(x => `#${x.id} ${x.type} ${x.area} ${x.price}`).join("\n"),
      clean(c.structure), clean(c.deposit), clean(c.monthlyRent), clean(c.location), clean(c.pet), clean(c.viewingDate),
      clean(d.message), "신규", ""
    ]);
    const row = sh.getLastRow();

    let kakao = "미연결";
    try {
      const head = `🏠 와방 새 문의 (${Utilities.formatDate(new Date(), "Asia/Seoul", "M/d HH:mm")})\n` +
                   `${d.name || "손님"} ${d.phone || ""}\n`;
      const link = items.length && items[0].link ? items[0].link : LINK_URL;
      sendKakaoLong_(head + String(d.message || "").replace(/^\[와방 · 매물 문의\]\n?/, ""), link);
      kakao = "발송";
    } catch (err) {
      kakao = "실패: " + err.message;
    }
    sh.getRange(row, 14).setValue(kakao);

    if (SEND_EMAIL_TOO && AGENT_EMAIL) {
      MailApp.sendEmail(AGENT_EMAIL, `[와방 문의] ${d.name || "손님"} ${d.phone || ""} · 매물 ${items.length}개`, String(d.message || ""));
    }
    return json_({ ok: true, kakao });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ===================== 카카오 연결 (웹앱 주소로 접속) ===================== */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const self = ScriptApp.getService().getUrl();

  if (p.code) {                       // 카카오 로그인 후 돌아온 경우 → 토큰 저장
    try {
      const t = kakaoToken_({ grant_type: "authorization_code", redirect_uri: self, code: p.code });
      saveToken_(t);
      sendKakao_("✅ 와방 문의 알림이 연결됐어요!\n이제 손님이 '중개사에게 바로 전송'을 누르면 여기로 문의가 와요.", LINK_URL);
      return html_("✅ 연결 완료!", "카카오톡 '나와의 채팅'에 테스트 메시지가 왔는지 확인해 주세요. 이 창은 닫으셔도 됩니다.");
    } catch (err) {
      return html_("❌ 연결 실패", "원인: " + err.message + "<br><br>Redirect URI 에 아래 주소가 정확히 등록돼 있는지 확인해 주세요.<br><code>" + self + "</code>");
    }
  }
  if (p.setup) {                      // 연결 시작 버튼
    const url = "https://kauth.kakao.com/oauth/authorize?response_type=code&scope=talk_message" +
      "&client_id=" + encodeURIComponent(KAKAO_REST_API_KEY) + "&redirect_uri=" + encodeURIComponent(self);
    return html_("카카오톡 알림 연결",
      `<a href="${url}" target="_top" style="display:block;margin-top:16px;padding:16px;border-radius:14px;background:#FEE500;color:#191919;font-weight:800;text-decoration:none;text-align:center">카카오톡 연결하기</a>
       <p style="margin-top:14px;color:#64748b;font-size:13px">문의를 받을 <b>중개사 본인 카카오 계정</b>으로 로그인해 주세요.</p>`);
  }
  if (p.test) {
    try { sendKakao_("🔔 와방 테스트 알림입니다.", LINK_URL); return html_("테스트 발송 완료", "카톡을 확인해 주세요."); }
    catch (err) { return html_("테스트 실패", err.message); }
  }
  const ok = !!PROPS.getProperty("KAKAO_REFRESH");
  return html_("와방 문의 접수 서버 작동 중", "카카오톡 연결 상태: " + (ok ? "✅ 연결됨" : "❌ 미연결 (주소 뒤에 ?setup=1 을 붙여 열어 연결하세요)"));
}

/* ===================== 처음 한 번 실행: 권한 허용 + 매일 자동 갱신 예약 ===================== */
function 설치하기() {
  getSheet_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "토큰갱신").forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("토큰갱신").timeBased().everyDays(1).atHour(4).create();
  UrlFetchApp.getRequest("https://kauth.kakao.com");   // 외부 연결 권한 요청용
  if (SEND_EMAIL_TOO) MailApp.getRemainingDailyQuota();
  Logger.log("설치 완료! 이제 웹 앱으로 배포하세요.");
}

/* 매일 새벽 자동 실행: 카카오 연결이 끊기지 않도록 토큰 갱신 */
function 토큰갱신() {
  if (PROPS.getProperty("KAKAO_REFRESH")) accessToken_(true);
}

/* ===================== 카카오 API ===================== */
function kakaoToken_(params) {
  const payload = Object.assign({ client_id: KAKAO_REST_API_KEY }, params);
  if (KAKAO_CLIENT_SECRET) payload.client_secret = KAKAO_CLIENT_SECRET;
  const res = UrlFetchApp.fetch("https://kauth.kakao.com/oauth/token", { method: "post", payload, muteHttpExceptions: true });
  const t = JSON.parse(res.getContentText());
  if (!t.access_token) throw new Error("토큰 발급 실패 " + res.getContentText());
  return t;
}
function saveToken_(t) {
  PROPS.setProperty("KAKAO_ACCESS", t.access_token);
  PROPS.setProperty("KAKAO_EXPIRES", String(Date.now() + (t.expires_in - 300) * 1000));
  if (t.refresh_token) PROPS.setProperty("KAKAO_REFRESH", t.refresh_token);   // 갱신 기간이 가까우면 새 refresh_token 이 옴
}
function accessToken_(force) {
  const refresh = PROPS.getProperty("KAKAO_REFRESH");
  if (!refresh) throw new Error("카카오톡 미연결 (웹앱주소?setup=1 로 연결 필요)");
  if (!force && Date.now() < Number(PROPS.getProperty("KAKAO_EXPIRES") || 0)) return PROPS.getProperty("KAKAO_ACCESS");
  saveToken_(kakaoToken_({ grant_type: "refresh_token", refresh_token: refresh }));
  return PROPS.getProperty("KAKAO_ACCESS");
}
function sendKakao_(text, link) {
  const tpl = { object_type: "text", text: text.slice(0, 200), link: { web_url: link, mobile_web_url: link }, button_title: "매물 보기" };
  const res = UrlFetchApp.fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "post", headers: { Authorization: "Bearer " + accessToken_() },
    payload: { template_object: JSON.stringify(tpl) }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error(res.getContentText());
}
/* 카톡 텍스트 메시지는 한 번에 200자까지라서, 긴 문의는 줄 단위로 나눠 여러 개로 보냄 */
function sendKakaoLong_(text, link) {
  const parts = [], lines = text.split("\n");
  let cur = "";
  lines.forEach(l => {
    while (l.length > 190) { if (cur) { parts.push(cur); cur = ""; } parts.push(l.slice(0, 190)); l = l.slice(190); }
    const next = cur ? cur + "\n" + l : l;
    if (next.length > 190) { parts.push(cur); cur = l; } else cur = next;
  });
  if (cur.trim()) parts.push(cur);
  parts.forEach((p, i) => { sendKakao_((parts.length > 1 ? `(${i + 1}/${parts.length}) ` : "") + p, link); if (i < parts.length - 1) Utilities.sleep(300); });
}

/* ===================== 도우미 ===================== */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["접수시간", "성함", "연락처", "매물번호", "선택 매물", "희망 구조", "보증금", "월세", "위치", "반려동물", "방 볼 수 있는 날", "전체 내용", "처리상태", "카톡알림"]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function html_(title, body) {
  return HtmlService.createHtmlOutput(
    `<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:-apple-system,sans-serif;max-width:420px;margin:40px auto;padding:0 20px">
     <h2 style="font-size:20px">${title}</h2><div style="font-size:15px;line-height:1.6;color:#334155">${body}</div></div>`
  ).setTitle("와방 알림").addMetaTag("viewport", "width=device-width, initial-scale=1");
}
