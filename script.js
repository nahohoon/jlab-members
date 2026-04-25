/**
 * J_LAB 회원관리 v4.6 — script.js
 * GitHub Pages SPA | Apps Script API 연동
 * ─────────────────────────────────────────────────────────────────
 * v4.5 변경:
 *   [1] 대시보드 세로형 단일컬럼 통일 (PC 2컬럼 분할 제거)
 *   [2] 대시보드 순서: 인사말→전광판→공지→행사→빠른실행→요약→미납
 *   [3] 행사 카드 onclick → data-* 속성 방식으로 변경 (저장 버그 근본 수정)
 *   [4] 모바일 빠른 실행 가로 스크롤 완전 차단
 *   [5] 공지사항 줄바꿈 정렬 수정 (text-align:left, block 구조)
 *   [6] image_url 지원 (NOTICE_MASTER, EVENT_MASTER)
 *   [7] Google Drive 링크 자동 변환 함수 추가
 *   [8] Code.gs와 member_id 복합키 완전 일치 보장
 * v4.6 변경:
 *   [1] PHOTO_GALLERY 행사 사진 갤러리 기능 추가
 *   [2] 행사 상세 화면 하단에 사진 배너 표시 (대시보드 제외)
 *   [3] 사진 클릭 시 전체화면 모달 (이전/다음 네비게이션 + 키보드 지원)
 *   [4] API.getPhotoGallery — event_name 기준 필터링
 * v4.5.2 변경:
 * [1] 모바일 공지사항 완전 강제 정렬 — 900/600/390px 구간 전체 재선언
 * [2] index.html ?v=455 캐시 버스터 적용
 * v4.5.1 변경:
 *   [1] 빠른 실행 메뉴 회비관리 버튼 제거 → 3개만 표시 (PC/모바일 공통)
 *   [2] 공지사항 카드 세로형 왼쪽 정렬 강화 (공지ID 표시 추가)
 */
'use strict';

/* ─── 전역 상태 ──────────────────────────────── */
var CFG = window.JLAB_CONFIG || {};
var S = {
  page        : 'dashboard',
  dashboard   : null,
  members     : [],
  gradYears   : [],
  regions     : [],
  events      : [],
  unpaid      : [],
  eventAttend : [],
  notices     : [],
  sponsorNotices: [],
  currentEvent: null,         // { id, name, date, venue }
  currentAttendList: [],      // 현재 행사 참석 목록 (index 기반 저장에 사용)
  filters     : { q:'', filter:'all', gradYear:'', region:'' }
};

/* ─── API ────────────────────────────────────── */
var API = {
  call: function(params) {
    var url = CFG.API_URL || '';
    if (!url || url.indexOf('YOUR_SCRIPT_ID') !== -1)
      return Promise.reject(new Error('config.js의 API_URL을 설정해 주세요.'));
    var u = new URL(url);
    Object.keys(params).forEach(function(k) { u.searchParams.set(k, params[k]); });
    return fetch(u.toString(), { redirect:'follow' })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
  },
  post: function(body) {
    var url = CFG.API_URL || '';
    if (!url || url.indexOf('YOUR_SCRIPT_ID') !== -1)
      return Promise.reject(new Error('config.js의 API_URL을 설정해 주세요.'));
    /*
     * [v4.5 수정] Content-Type을 text/plain으로 변경
     * Google Apps Script 웹앱은 application/json 헤더가 붙은 POST를 받으면
     * CORS preflight(OPTIONS)가 발생하는데 GAS는 OPTIONS를 처리하지 않아
     * fetch 자체가 네트워크 오류로 실패함.
     * text/plain으로 보내면 simple request로 처리되어 preflight 없이
     * doPost(e)에 정상 도달하며, e.postData.contents를 JSON.parse하므로
     * 서버 측 동작에는 변화 없음.
     */
    return fetch(url, {
      method:'POST', redirect:'follow',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body: JSON.stringify(body)
    }).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status+' — Apps Script 응답 오류');
      return r.json();
    }).catch(function(fetchErr) {
      /* fetch 자체 실패 시 원인 구분 */
      var msg = fetchErr.message || String(fetchErr);
      if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1) {
        throw new Error('네트워크 오류: Apps Script URL을 확인하거나 배포 권한(모든 사람)을 확인하세요.');
      }
      throw fetchErr;
    });
  },

  /* GET */
  dash    : function()    { return API.call({ action:'getDashboard' }); },
  members : function(p)   { return API.call(Object.assign({ action:'getMembers' }, p)); },
  detail  : function(ri)  { return API.call({ action:'getMemberDetail', rowIndex:ri }); },
  grads   : function()    { return API.call({ action:'getGradYears' }); },
  regions : function()    { return API.call({ action:'getRegions' }); },
  unpaid  : function()    { return API.call({ action:'getUnpaidMembers' }); },
  events  : function()    { return API.call({ action:'getEventList' }); },
  notices : function(n)   { return API.call({ action:'getNotices', limit:n||5 }); },

  /* [신규] 행사 참석 */
  getEventAttend      : function(eid) { return API.call({ action:'getEventAttend', event_id:eid }); },
  getEventAttendSummary: function(eid){ return API.call({ action:'getEventAttendSummary', event_id:eid }); },
  saveEventAttend     : function(data){ return API.post(Object.assign({ action:'saveEventAttend' }, data)); },

  /* [신규] 찬조 전광판 */
  getSponsorNotices   : function()    { return API.call({ action:'getSponsorNotices' }); },
  saveSponsorNotice   : function(data){ return API.post(Object.assign({ action:'saveSponsorNotice' }, data)); },
  updateSponsorNotice : function(data){ return API.post(Object.assign({ action:'updateSponsorNotice' }, data)); },

  /* 기존 호환 */
  attend          : function(id) { return API.call({ action:'getEventAttendance', eventId:id }); },
  saveFee         : function(ri, val) { return API.post({ action:'updateFeeStatus', rowIndex:ri, value:val }); },
  saveEventAttendLegacy: function(ri,col,val){ return API.post({ action:'updateEventAttend', rowIndex:ri, col:col, value:val }); },
  addEventAttend  : function(body){ return API.post(Object.assign({ action:'addEventAttend' }, body)); },

  /* [v4.6] 행사 사진 갤러리 */
  getPhotoGallery : function(eventName) {
    return API.call({ action:'getPhotoGallery', event_name: eventName || '', limit: 50 });
  }
};

/* ─── 유틸 ───────────────────────────────────── */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function isFeeY(v) { var s=String(v||'').trim().toLowerCase(); return s==='y'||s==='납부'||s==='완료'||s==='1'||s==='true'; }
function isAttnY(v){ var s=String(v||'').trim().toLowerCase(); return s==='y'||s==='참석'||s==='1'||s==='true'; }
function isImpY(v) { var s=String(v||'').trim().toLowerCase(); return s==='y'||s==='중요'||s==='1'||s==='true'; }
function fmtPhone(p){ if(!p) return ''; return String(p).replace(/[^0-9]/g,'').replace(/^(\d{2,3})(\d{3,4})(\d{4})$/,'$1-$2-$3'); }
function fmtMoney(n){ return Number(n).toLocaleString('ko-KR')+'원'; }
function initial(name){ return name ? String(name).charAt(0) : 'J'; }
function feeBadge(v){ return isFeeY(v) ? '<span class="badge b-paid">✓ 납부</span>' : '<span class="badge b-unpaid">✗ 미납</span>'; }
function attnBadge(v){ return isAttnY(v) ? '<span class="badge b-attend">✓ 참석</span>' : '<span class="badge b-absent">✗ 불참</span>'; }

/* 3상태 뱃지 */
function attendStatusBadge(s) {
  if (s==='참석') return '<span class="badge b-attend">✓ 참석</span>';
  if (s==='불참') return '<span class="badge b-absent">✗ 불참</span>';
  return '<span class="badge b-undecided">? 미정</span>';
}
function payStatusBadge(s) {
  if (s==='납부') return '<span class="badge b-paid">✓ 납부</span>';
  if (s==='면제') return '<span class="badge b-exempt">◎ 면제</span>';
  return '<span class="badge b-unpaid">✗ 미납</span>';
}

function parseEventDate(s) {
  if (!s) return null;
  // GAS에서 Date 객체로 넘어온 경우 그대로 반환
  if (s instanceof Date) return isNaN(s.getTime()) ? null : s;
  var str = String(s).trim();
  if (!str) return null;
  // 직접 파싱 시도
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  // 한국어 형식 정리
  var c = str
    .replace(/년\s*/g,'-').replace(/월\s*/g,'-').replace(/일.*/g,'')
    .replace(/\./g,'-').replace(/\//g,'-')
    .replace(/\s+/g,'-').replace(/-{2,}/g,'-').replace(/-$/,'').trim();
  d = new Date(c);
  return isNaN(d.getTime()) ? null : d;
}
function dDayTag(dateStr) {
  var d = parseEventDate(dateStr); if (!d) return '';
  var diff = Math.ceil((d.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return '<span class="day-tag day-today">오늘</span>';
  if (diff > 0)  return '<span class="day-tag day-coming">D-'+diff+'</span>';
  return '<span class="day-tag day-past">종료</span>';
}
var _tt;
function toast(msg, type) {
  var el=document.getElementById('toast'); if(!el) return;
  el.textContent=msg; el.className='show'+(type?' t-'+type:'');
  clearTimeout(_tt); _tt=setTimeout(function(){ el.className=''; },3000);
}
function $id(id){ return document.getElementById(id); }
function setContent(html){ $id('content').innerHTML = html; }
function setLoading(){ setContent('<div class="pg-loading"><div class="pg-spinner"></div><p class="pg-loading-txt">데이터를 불러오는 중...</p></div>'); }
function ilLoad(){ return '<tr><td colspan="20"><div class="il-load"><div class="mini-spin"></div>로딩 중...</div></td></tr>'; }
function tblEmpty(msg){ return '<tr><td colspan="20"><div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">'+(msg||'결과 없음')+'</div><div class="empty-desc">검색어 또는 필터를 변경해 보세요.</div></div></td></tr>'; }
function errHtml(msg){ return '<div class="empty" style="padding:60px 20px"><div class="empty-icon">⚠️</div><div class="empty-title">데이터 로드 실패</div><div class="empty-desc" style="color:var(--red)">'+esc(msg||'')+'</div><div class="empty-desc" style="margin-top:8px">config.js의 API_URL을 확인하세요.</div></div>'; }

/* ─── 이미지 URL 정규화 (Google Drive 공유 링크 자동 변환) ─── */
function normalizeImageUrl(url) {
  if (!url) return '';
  var s = String(url).trim();
  if (!s) return '';
  // https://drive.google.com/file/d/파일ID/view... → 직접 표시 URL로 변환
  var m = s.match(/\/d\/([^/\?&]+)/);
  if (m && m[1]) return 'https://drive.google.com/uc?export=view&id=' + m[1];
  // 이미 uc?export=view 형식이면 그대로
  return s;
}

/* ─── Router ─────────────────────────────────── */
var PAGE_INFO = {
  dashboard : { title:'대시보드',      bc:'홈 / 대시보드' },
  members   : { title:'회원관리',      bc:'홈 / 회원관리' },
  fees      : { title:'회비관리',      bc:'홈 / 회비관리' },
  events    : { title:'행사관리',      bc:'홈 / 행사관리' },
  unpaid    : { title:'회비 미납 현황', bc:'홈 / 회비 미납 현황' }
};
function navigate(page) {
  S.page = page;
  var info = PAGE_INFO[page] || { title:page, bc:'홈 / '+page };
  var titleEl=$id('pageTitle'); if(titleEl) titleEl.textContent=info.title;
  var bcEl=$id('pageBc');       if(bcEl)   bcEl.textContent=info.bc;
  document.querySelectorAll('.nav-item').forEach(function(el){
    el.classList.toggle('active', el.getAttribute('data-page')===page);
  });
  document.querySelectorAll('.bnav-item').forEach(function(el){
    el.classList.toggle('active', el.getAttribute('data-page')===page);
  });
  closeSidebar();
  renderPage(page);
}
function renderPage(page) {
  setLoading();
  var map = { dashboard:renderDashboard, members:renderMembers, fees:renderFees, events:renderEvents, unpaid:renderUnpaid };
  if (map[page]) map[page]();
}

/* ═══════════════════════════════════════════════
   [v4] LED 전광판 — 찬조 감사
═══════════════════════════════════════════════ */
var _tickerTimer = null;
var _tickerAnim  = null;

function buildTicker(notices) {
  // is_active 관계없이 notice_message가 있는 항목 모두 사용
  // (Code.gs에서 이미 is_active=Y만 반환)
  var msgs = (notices || [])
    .map(function(n){ return String(n.notice_message || '').trim(); })
    .filter(function(m){ return m !== ''; });

  if (!msgs.length) return '';

  // 여러 개를 구분자(★)로 연결 — esc() 적용 후 HTML entity 복원
  var combined = msgs.join('　　　★　　　');

  return '<div id="sponsorTickerWrap" class="ticker-wrap">' +
    '<div class="ticker-label">🎉 찬조 감사</div>' +
    '<div class="ticker-track">' +
    '<div id="tickerText" class="ticker-text">' + esc(combined) + '</div>' +
    '</div>' +
    '</div>';
}

function startTicker() {
  // DOM 렌더 완료 후 실행 보장 — 최대 10회 재시도
  var attempts = 0;
  function tryStart() {
    var track = document.querySelector('.ticker-track');
    var text  = $id('tickerText');
    if (!track || !text) return;

    var textW  = text.scrollWidth;
    var trackW = track.offsetWidth || track.clientWidth;

    // scrollWidth가 0이면 아직 렌더 안됨 → 재시도
    if (textW === 0 && attempts < 10) {
      attempts++;
      setTimeout(tryStart, 150);
      return;
    }
    if (textW === 0) return; // 포기

    var speed    = 80; // px/sec
    var duration = Math.max(5, Math.round((textW + trackW) / speed));

    var styleId  = 'ticker-keyframe-style';
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();

    var style = document.createElement('style');
    style.id  = styleId;
    style.textContent =
      '@keyframes tickerScroll {' +
      '  0%   { transform: translateX(' + trackW + 'px); }' +
      '  100% { transform: translateX(-' + textW  + 'px); }' +
      '}';
    document.head.appendChild(style);

    // 기존 animation 초기화 후 재적용
    text.style.animation = 'none';
    // reflow 강제
    void text.offsetWidth;
    text.style.animation = 'tickerScroll ' + duration + 's linear infinite';
  }
  setTimeout(tryStart, 200);
}

/* ═══════════════════════════════════════════════
   대시보드 — v4.5
   순서: 인사말 → 전광판 → 공지 → 행사 → 빠른실행 → 요약 → 미납배너
═══════════════════════════════════════════════ */
function renderDashboard() {
  Promise.all([
    S.dashboard ? Promise.resolve(S.dashboard) : API.dash(),
    API.notices(5).catch(function(){ return {success:true,notices:[]}; }),
    API.getSponsorNotices().catch(function(){ return {success:true,notices:[]}; })
  ])
  .then(function(res) {
    var d = res[0];
    if (!d.success) { setContent(errHtml(d.error)); return; }
    S.dashboard = d;

    var notices        = (res[1].success && res[1].notices) ? res[1].notices : [];
    var sponsorNotices = (res[2].success && res[2].notices) ? res[2].notices : [];
    S.sponsorNotices   = sponsorNotices;

    setSyncText();

    var fee      = CFG.ANNUAL_FEE || 0;
    var pct      = d.feeRate || 0;
    var upcoming = d.upcomingEvents || [];

    /* ── 1. 인사말 (PC/모바일 공통) ── */
    var greetingHtml =
      '<div class="dash-greeting">' +
      '<h2>안녕하세요, <span class="dash-org">J_LAB 회원여러분</span>. 화이팅^^</h2>' +
      '<p>오늘의 운영 현황입니다.</p>' +
      '</div>';

    /* ── 2. LED 전광판 (유지) ── */
    var tickerHtml = sponsorNotices.length ? buildTicker(sponsorNotices) : '';

    /* ── 3. 공지사항 (최근 5개, image_url 지원) ── */
    var noticeCardHtml = '';
    if (notices.length) {
      noticeCardHtml =
        '<div class="dash-sec-lbl">📢 공지사항</div>' +
        '<div class="notice-list">' +
        notices.map(function(n) {
          var imp = isImpY(n.important);
          var imgHtml = n.image_url
            ? '<img class="notice-img" src="'+esc(normalizeImageUrl(n.image_url))+'" alt="공지 이미지" onerror="this.style.display=\'none\'">'
            : '';
          return '<div class="notice-item'+(imp?' notice-imp':'')+'">' +
            '<div class="notice-block">' +
            (imp ? '<span class="notice-badge">중요</span>' : '') +
            (n.id ? '<div class="notice-id">'+esc(n.id)+'</div>' : '') +
            '<div class="notice-title">'+esc(n.title)+'</div>' +
            (n.body ? '<div class="notice-body">'+esc(n.body)+'</div>' : '') +
            imgHtml +
            (n.date ? '<div class="notice-date">'+esc(n.date)+'</div>' : '') +
            '</div>' +
            '</div>';
        }).join('') +
        '</div>';
    }

    /* ── 4. 다가오는 행사 (image_url 지원) ── */
    var upcomingHtml;
    if (upcoming.length) {
      upcomingHtml =
        '<div class="dash-sec-lbl">📅 다가오는 행사</div>' +
        '<div class="upcoming-list">' +
        upcoming.map(function(ev) {
          var imgHtml = ev.image_url
            ? '<img class="event-card-img" src="'+esc(normalizeImageUrl(ev.image_url))+'" alt="행사 이미지" onerror="this.style.display=\'none\'">'
            : '';
          return '<div class="upcoming-card">' +
            '<div class="uc-top">' +
            '<div class="uc-name">'+esc(ev.name)+'</div>' +
            dDayTag(ev.date) +
            '</div>' +
            '<div class="uc-meta">' +
            (ev.date  ? '<span><span class="uc-ico">🗓</span>'+esc(ev.date)+'</span>'  : '') +
            (ev.venue ? '<span><span class="uc-ico">📍</span>'+esc(ev.venue)+'</span>' : '') +
            (ev.fee   ? '<span><span class="uc-ico">💰</span>'+esc(ev.fee)+'</span>'   : '') +
            '</div>' +
            (ev.note ? '<div class="uc-note">📝 '+esc(ev.note)+'</div>' : '') +
            imgHtml +
            '</div>';
        }).join('') +
        '</div>';
    } else {
      upcomingHtml =
        '<div class="dash-sec-lbl">📅 다가오는 행사</div>' +
        '<div class="upcoming-empty">' +
        '<span style="font-size:1.4rem">📅</span>' +
        '<span>예정된 행사가 없습니다<br/>' +
        '<span style="font-size:.75rem;color:var(--gr400)">EVENT_MASTER 시트에 행사를 등록하세요</span>' +
        '</span>' +
        '</div>';
    }

    /* ── 5. 빠른 실행 (v4.5.1: 3개만 표시, 회비관리 제거) ── */
    var quickHtml =
      '<div class="dash-sec-lbl">⚡ 빠른 실행</div>' +
      '<div class="v45-quick v45-quick-3">' +
      qBtn('👥','회원관리','members') +
      qBtn('📅','행사관리','events') +
      qBtn('⚠️','회비 미납 현황','unpaid') +
      '</div>';

    /* ── 6. 운영 요약 미니 카드 + 납부율 바 ── */
    var miniHtml =
      '<div class="dash-sec-lbl">📊 운영 요약</div>' +
      '<div class="mini-stat-row">' +
      mStat('총 회원수', d.total,     '명', 'ms-total') +
      mStat('회비 납부', d.feePaid,   '명', 'ms-paid') +
      mStat('회비 미납', d.feeUnpaid, '명', 'ms-unpaid') +
      '</div>' +
      '<div class="v45-fee-bar-wrap">' +
      '<div class="v45-fee-bar-label">납부율 <strong>'+pct+'%</strong></div>' +
      '<div class="prog-bar-track" style="height:10px;margin-top:6px">' +
      '<div class="prog-bar-fill" style="width:'+pct+'%"></div>' +
      '</div>' +
      '</div>';

    /* ── 7. 미납 배너 ── */
    var unpaidBanner =
      '<div class="unpaid-banner" onclick="navigate(\'unpaid\')" role="button" tabindex="0">' +
      '<div class="ub-left">' +
      '<div class="ub-dot"></div>' +
      '<div>' +
      '<div class="ub-title">⚠️ 회비 미납 현황</div>' +
      '<div class="ub-desc">미납자 <strong>'+d.feeUnpaid+'명</strong>' +
      (fee ? ' · 예상 미수금 <strong>'+fmtMoney(d.feeUnpaid*fee)+'</strong>' : '') +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="ub-arrow">›</div>' +
      '</div>';

    /* ── 최종 렌더 (세로형 단일컬럼 — PC/모바일 공통) ── */
    setContent(
      greetingHtml +
      tickerHtml +
      noticeCardHtml +
      upcomingHtml +
      quickHtml +
      miniHtml +
      unpaidBanner
    );

    if (sponsorNotices.length) startTicker();
  })
  .catch(function(e){ setContent(errHtml(e.message)); });
}


function qBtn(icon, label, page, extraCls) {
  var cls = 'quick-btn' + (extraCls ? ' ' + extraCls : '');
  return '<button class="'+cls+'" onclick="navigate(\''+page+'\')">' +
    '<span class="qb-icon">'+icon+'</span><span class="qb-label">'+label+'</span></button>';
}
function mStat(label, num, unit, cls) {
  return '<div class="mini-stat '+cls+'">' +
    '<div class="ms-num">'+num+'<span class="ms-unit">'+unit+'</span></div>' +
    '<div class="ms-label">'+label+'</div>' +
    '</div>';
}

/* ═══════════════════════════════════════════════
   회원관리 (기존 유지)
═══════════════════════════════════════════════ */
function renderMembers() {
  Promise.all([
    S.gradYears.length ? Promise.resolve({success:true,years:S.gradYears}) : API.grads(),
    S.regions.length   ? Promise.resolve({success:true,regions:S.regions}) : API.regions()
  ]).then(function(res) {
    if(res[0].success) S.gradYears=res[0].years||[];
    if(res[1].success) S.regions=res[1].regions||[];
    buildMembersPage();
    loadMemberTable();
  }).catch(function(e){ setContent(errHtml(e.message)); });
}

function buildMembersPage() {
  var gOpts = '<option value="">전체 기수</option>' +
    S.gradYears.map(function(y){
      return '<option value="'+esc(y)+'"'+(S.filters.gradYear===y?' selected':'')+'>'+esc(y)+'년도</option>';
    }).join('');
  var rOpts = '<option value="">전체 지역</option>' +
    S.regions.map(function(r){
      return '<option value="'+esc(r)+'"'+(S.filters.region===r?' selected':'')+'>'+esc(r)+'</option>';
    }).join('');

  setContent(
    '<div class="ctrl-bar">' +
    '<div class="search-wrap">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
    '<input id="searchInput" class="search-input" type="text" placeholder="이름, 연락처, 이메일, 소속, 특이사항 검색..." value="'+esc(S.filters.q)+'" autocomplete="off"/>' +
    '</div>' +
    '<select id="filterGrad" class="filter-sel">'+gOpts+'</select>' +
    '<select id="filterRegion" class="filter-sel">'+rOpts+'</select>' +
    '</div>' +
    '<div class="ctrl-bar" style="padding-top:10px;padding-bottom:10px">' +
    '<div class="ftabs" id="ftabs">' +
    ftab('all','전체') + ftab('feePaid','✅ 납부') + ftab('feeUnpaid','⚠️ 미납') +
    '</div>' +
    '</div>' +
    '<div class="tbl-card">' +
    '<div class="tbl-hdr"><span class="tbl-hdr-title">📋 회원 목록</span><span class="res-badge" id="mCnt">로딩 중...</span></div>' +
    '<div class="tbl-scroll">' +
    '<table><thead><tr>' +
    '<th>이름</th><th>기수</th><th>연락처</th><th>이메일</th>' +
    '<th>현소속</th><th class="th-gold">회비</th><th style="text-align:center">상세</th>' +
    '</tr></thead><tbody id="mTbody">'+ilLoad()+'</tbody></table>' +
    '</div>' +
    '</div>'
  );

  var timer;
  var si = $id('searchInput');
  if(si) si.addEventListener('input',function(){
    clearTimeout(timer); var v=this.value;
    timer=setTimeout(function(){ S.filters.q=v.trim(); loadMemberTable(); },380);
  });
  var fg = $id('filterGrad'); if(fg) fg.addEventListener('change',function(){ S.filters.gradYear=this.value; loadMemberTable(); });
  var fr = $id('filterRegion'); if(fr) fr.addEventListener('change',function(){ S.filters.region=this.value; loadMemberTable(); });
  document.querySelectorAll('#ftabs .ftab').forEach(function(btn){
    btn.addEventListener('click',function(){
      S.filters.filter = this.getAttribute('data-f');
      document.querySelectorAll('#ftabs .ftab').forEach(function(b){ b.classList.remove('active'); });
      this.classList.add('active'); loadMemberTable();
    });
  });
}

function ftab(v,lbl){ return '<button class="ftab'+(S.filters.filter===v?' active':'')+'" data-f="'+v+'">'+lbl+'</button>'; }

function loadMemberTable() {
  var tbody=$id('mTbody'), cntEl=$id('mCnt');
  if(tbody) tbody.innerHTML=ilLoad();
  API.members({ q:S.filters.q, filter:S.filters.filter, gradYear:S.filters.gradYear, region:S.filters.region })
    .then(function(d){
      if(!d.success){ if(tbody) tbody.innerHTML=tblEmpty(d.error); return; }
      S.members=d.members||[];
      if(cntEl) cntEl.textContent=S.members.length+'명';
      if(!tbody) return;
      if(!S.members.length){ tbody.innerHTML=tblEmpty('검색 결과가 없습니다'); return; }
      tbody.innerHTML=S.members.map(function(m){
        var ph=m.phone?'<a class="lk-phone" href="tel:'+esc(m.phone)+'">'+esc(fmtPhone(m.phone))+'</a>':'—';
        var em=m.email?'<a class="lk-email" href="mailto:'+esc(m.email)+'" title="'+esc(m.email)+'">'+esc(m.email.split('@')[0])+'@…</a>':'—';
        return '<tr>'+
          '<td class="td-name">'+esc(m.name||'—')+'</td>'+
          '<td class="td-num">'+esc(m.gradYear||'—')+'</td>'+
          '<td>'+ph+'</td>'+
          '<td><span class="truncate" title="'+esc(m.email)+'">'+em+'</span></td>'+
          '<td><span class="truncate" title="'+esc(m.org)+'">'+esc(m.org||'—')+'</span></td>'+
          '<td>'+feeBadge(m.feePaid)+'</td>'+
          '<td class="td-c"><button class="btn btn-primary btn-sm" onclick="openModal('+m.rowIndex+')">상세보기</button></td>'+
          '</tr>';
      }).join('');
    }).catch(function(e){ if(tbody) tbody.innerHTML=tblEmpty(e.message); });
}

/* ═══════════════════════════════════════════════
   회비관리 (기존 유지)
═══════════════════════════════════════════════ */
function renderFees() {
  API.members({ filter:'all', q:'', gradYear:'', region:'' }).then(function(d){
    if(!d.success){ setContent(errHtml(d.error)); return; }
    var all=d.members||[];
    var paid=all.filter(function(m){ return isFeeY(m.feePaid); });
    var unpd=all.filter(function(m){ return !isFeeY(m.feePaid); });
    var pct=all.length?Math.round(paid.length/all.length*100):0;
    var fee=CFG.ANNUAL_FEE||0;

    var gradMap={};
    all.forEach(function(m){
      var y=m.gradYear||'미상';
      if(!gradMap[y]) gradMap[y]={paid:0,unpaid:0};
      isFeeY(m.feePaid)?gradMap[y].paid++:gradMap[y].unpaid++;
    });
    var gradRows=Object.keys(gradMap).sort(function(a,b){ return Number(b)-Number(a); }).map(function(y){
      var g=gradMap[y], t=g.paid+g.unpaid, p=Math.round(g.paid/t*100);
      return '<tr><td class="td-name">'+esc(y)+(y!=='미상'?'년도':'')+'</td><td>'+t+'명</td>'+
        '<td><span class="badge b-paid">'+g.paid+'명</span></td>'+
        '<td><span class="badge b-unpaid">'+g.unpaid+'명</span></td>'+
        '<td><div style="display:flex;align-items:center;gap:8px">'+
        '<div class="grad-bar-track" style="width:80px"><div class="grad-bar-fill" style="width:'+p+'%"></div></div>'+
        '<span style="font-size:.78rem;font-weight:700;color:var(--gr600)">'+p+'%</span></div></td></tr>';
    }).join('');

    setContent(
      '<div class="prog-card">' +
      '<div class="prog-title">연간 회비 납부 현황</div>' +
      '<div class="prog-stats">' +
      '<div><div class="prog-main"><span id="feeRN">'+pct+'</span><span class="prog-unit">%</span></div></div>' +
      '<div class="prog-detail">납부 <strong style="color:var(--white)">'+paid.length+'명</strong> · ' +
      '미납 <strong style="color:#fca5a5">'+unpd.length+'명</strong>' +
      (fee?' · 미수금 <strong style="color:#fcd34d">'+fmtMoney(unpd.length*fee)+'</strong>':'')+
      '</div>' +
      '</div>' +
      '<div class="prog-bar-track" style="height:12px"><div class="prog-bar-fill" style="width:'+pct+'%"></div></div>' +
      '</div>' +
      '<div class="card mb16">' +
      '<div class="card-hdr"><div class="card-title"><div class="card-icon">📊</div>기수별 납부 현황</div></div>' +
      '<div class="tbl-scroll"><table>' +
      '<thead><tr><th>기수</th><th>전체</th><th class="th-gold">납부</th><th>미납</th><th>납부율</th></tr></thead>' +
      '<tbody>'+(gradRows||tblEmpty('기수 데이터 없음'))+'</tbody>' +
      '</table></div>' +
      '</div>' +
      '<div class="tbl-card">' +
      '<div class="tbl-hdr">' +
      '<span class="tbl-hdr-title">💳 회원별 납부 현황</span>' +
      '<span class="res-badge">'+all.length+'명</span>' +
      '</div>' +
      '<div class="tbl-scroll"><table>' +
      '<thead><tr><th>이름</th><th>기수</th><th>현소속</th><th>연락처</th><th class="th-gold">납부상태</th><th style="text-align:center">변경</th></tr></thead>' +
      '<tbody>' +
      all.map(function(m){
        var ph=m.phone?'<a class="lk-phone" href="tel:'+esc(m.phone)+'">'+esc(fmtPhone(m.phone))+'</a>':'—';
        var curY=isFeeY(m.feePaid);
        var toggleBtn=
          '<button class="btn btn-xs '+(curY?'btn-fee-revert':'btn-fee-pay')+'" ' +
          'onclick="toggleFee(this,'+m.rowIndex+',\''+(curY?'N':'Y')+'\')">' +
          (curY?'↩ 미납처리':'✓ 납부처리') +
          '</button>';
        return '<tr id="fee-row-'+m.rowIndex+'">' +
          '<td class="td-name">'+esc(m.name||'—')+'</td>' +
          '<td class="td-num">'+esc(m.gradYear||'—')+'</td>' +
          '<td><span class="truncate">'+esc(m.org||'—')+'</span></td>' +
          '<td>'+ph+'</td>' +
          '<td id="fee-badge-'+m.rowIndex+'">'+feeBadge(m.feePaid)+'</td>' +
          '<td class="td-c">'+toggleBtn+'</td>' +
          '</tr>';
      }).join('') +
      '</tbody>' +
      '</table></div>' +
      '</div>'
    );
  }).catch(function(e){ setContent(errHtml(e.message)); });
}

function toggleFee(btn, rowIndex, newVal) {
  btn.disabled = true; btn.textContent = '저장 중...';
  API.saveFee(rowIndex, newVal)
    .then(function(r) {
      if (!r.success) { toast('저장 실패: '+(r.error||''), 'err'); btn.disabled=false; btn.textContent=(newVal==='Y'?'✓ 납부처리':'↩ 미납처리'); return; }
      var badgeEl = $id('fee-badge-'+rowIndex);
      if (badgeEl) badgeEl.innerHTML = feeBadge(newVal==='Y'?'Y':'N');
      btn.textContent = (newVal==='Y' ? '↩ 미납처리' : '✓ 납부처리');
      btn.className = 'btn btn-xs '+(newVal==='Y' ? 'btn-fee-revert' : 'btn-fee-pay');
      btn.setAttribute('onclick', 'toggleFee(this,'+rowIndex+',\''+(newVal==='Y'?'N':'Y')+'\')');
      btn.disabled = false;
      toast((newVal==='Y'?'납부 처리':'미납 처리')+'되었습니다.', 'ok');
      S.dashboard = null;
    })
    .catch(function(e){ toast(e.message,'err'); btn.disabled=false; });
}

/* ═══════════════════════════════════════════════
   [v4] 행사관리 — 행사 목록 + 상세 운영 화면
═══════════════════════════════════════════════ */
function renderEvents() {
  API.events().then(function(d){
    S.events = (d.success && d.events) ? d.events : [];
    buildEventsPage();
  }).catch(function(e){ setContent(errHtml(e.message)); });
}

function buildEventsPage() {
  var hasSheet = S.events.length > 0;
  var guide = !hasSheet ?
    '<div class="notice-box"><div class="notice-box-title">📋 행사 시트 설정 안내</div>' +
    '<div class="notice-box-body">구글 시트에 <code>EVENT_MASTER</code> 시트를 추가하면 행사 목록이 자동 표시됩니다.<br/>' +
    '컬럼: <code>행사ID</code> · <code>행사명</code> · <code>행사일</code> · <code>장소</code> · <code>참가비</code> · <code>비고</code></div></div>' : '';

  /* [v4.5] onclick 문자열 방식 → data-event-idx 방식으로 변경
     행사명/장소에 따옴표·특수문자가 있어도 JS 파싱 오류 없이 동작 보장 */
  var cards = S.events.map(function(e, idx) {
    var imgHtml = e.image_url
      ? '<img class="event-card-img" src="'+esc(normalizeImageUrl(e.image_url))+'" alt="행사 이미지" onerror="this.style.display=\'none\'">'
      : '';
    return '<div class="event-card" data-event-idx="'+idx+'">' +
      '<div class="ev-name">'+esc(e.name)+'</div>' +
      '<div class="ev-info">' +
      (e.date  ? '<span>📅 '+esc(e.date)+'</span>'  : '') +
      (e.venue ? '<span>📍 '+esc(e.venue)+'</span>' : '') +
      (e.fee   ? '<span>💰 '+esc(e.fee)+'</span>'   : '') +
      (e.note  ? '<span>📝 '+esc(e.note)+'</span>'  : '') +
      '</div>' +
      imgHtml +
      '<div class="ev-foot"><span class="ev-id-badge">ID: '+esc(e.id)+'</span><span class="ev-view">참석 관리 →</span></div>' +
      '</div>';
  }).join('');

  setContent(
    guide +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
    '<div style="font-size:.92rem;font-weight:700;color:var(--n800)">📅 행사 목록 ' +
    '<span style="color:var(--gr400);font-weight:500;font-size:.8rem">'+S.events.length+'건</span></div>' +
    '</div>' +
    (hasSheet ? '<div class="event-grid" id="eventGrid">'+cards+'</div>' :
      '<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">등록된 행사가 없습니다</div><div class="empty-desc">EVENT_MASTER 시트에 행사를 등록하세요.</div></div>') +
    '<div id="eventDetailSec"></div>'
  );

  /* 행사 카드 클릭 이벤트 — DOM 렌더 후 바인딩 */
  var grid = $id('eventGrid');
  if (grid) {
    grid.addEventListener('click', function(e) {
      var card = e.target.closest('[data-event-idx]');
      if (!card) return;
      var idx = parseInt(card.getAttribute('data-event-idx'));
      var ev  = S.events[idx];
      if (!ev) return;
      openEventDetail(ev.id, ev.name, ev.date, ev.venue);
    });
  }
}

/* ── 행사 상세 운영 화면 진입 ── */
function openEventDetail(eventId, eventName, eventDate, eventVenue) {
  var sec = $id('eventDetailSec'); if (!sec) return;
  S.currentEvent = { id: eventId, name: eventName, date: eventDate, venue: eventVenue };

  // 페이지 타이틀 업데이트
  var titleEl = $id('pageTitle'); if(titleEl) titleEl.textContent = '행사 상세 운영';
  var bcEl    = $id('pageBc');    if(bcEl)    bcEl.textContent    = '홈 / 행사관리 / '+eventName;

  // 위로 스크롤
  sec.scrollIntoView({ behavior:'smooth', block:'start' });
  sec.innerHTML =
    '<div class="ev-detail-loading"><div class="mini-spin"></div> 참석 정보를 불러오는 중...</div>';

  API.getEventAttend(eventId)
    .then(function(d) {
      if (!d.success) { sec.innerHTML = errHtml(d.error||'참석 데이터 로드 실패'); return; }
      renderEventDetail(sec, d);
    })
    .catch(function(e) { sec.innerHTML = errHtml(e.message); });
}

function renderEventDetail(sec, d) {
  // ── 전역 참석 목록 저장 (인덱스 기반 저장에 사용) ──
  S.currentAttendList = d.attendance || [];
  var list = S.currentAttendList;

  var total     = list.length;
  var attend    = list.filter(function(a){ return a.attend_status  === '참석'; }).length;
  var absent    = list.filter(function(a){ return a.attend_status  === '불참'; }).length;
  var undecided = list.filter(function(a){ return a.attend_status  === '미정'; }).length;
  var paid      = list.filter(function(a){ return a.payment_status === '납부'; }).length;
  var unpaid    = list.filter(function(a){ return a.payment_status === '미납'; }).length;
  var exempt    = list.filter(function(a){ return a.payment_status === '면제'; }).length;

  // ── 버튼 onclick에는 인덱스(숫자)만 전달 → 인코딩 문제 완전 제거 ──
  var rows = list.map(function(a, idx) {
    return '<div class="ea-row" id="ea_'+idx+'">' +
      '<div class="ea-member-info">' +
      '<div class="ea-name">'+esc(a.member_name||'—')+'</div>' +
      '<div class="ea-meta">'+(a.generation ? a.generation+'기' : '')+(a.phone ? ' · '+esc(fmtPhone(a.phone)) : '')+'</div>' +
      '</div>' +
      '<div class="ea-status-col">' +
      '<div class="ea-status-lbl">참석</div>' +
      '<div class="ea-btn-group" id="attend-grp-'+idx+'">' +
      attendBtn(idx, a, '참석') +
      attendBtn(idx, a, '불참') +
      attendBtn(idx, a, '미정') +
      '</div>' +
      '</div>' +
      '<div class="ea-status-col">' +
      '<div class="ea-status-lbl">납부</div>' +
      '<div class="ea-btn-group" id="pay-grp-'+idx+'">' +
      payBtn(idx, a, '납부') +
      payBtn(idx, a, '미납') +
      payBtn(idx, a, '면제') +
      '</div>' +
      '</div>' +
      '<div class="ea-memo-col">' +
      '<input class="ea-memo-input" id="memo-'+idx+'" type="text" placeholder="메모..." value="'+esc(a.memo||'')+'" ' +
      'onchange="saveMemo('+idx+',this.value)"/>' +
      '</div>' +
      '</div>';
  }).join('');

  sec.innerHTML =
    '<div class="ev-detail-card">' +
    /* 상단 헤더 */
    '<div class="ev-detail-hdr">' +
    '<button class="btn btn-outline btn-sm" onclick="closeEventDetail()" style="margin-bottom:12px">← 목록으로</button>' +
    '<div class="ev-detail-title">'+esc(d.event_name||'행사')+'</div>' +
    '<div class="ev-detail-meta">' +
    (d.event_date  ? '<span>📅 '+esc(d.event_date)+'</span>'  : '') +
    (d.event_venue ? '<span>📍 '+esc(d.event_venue)+'</span>' : '') +
    '</div>' +
    '</div>' +
    /* 요약 통계 */
    '<div class="ev-summary-grid">' +
    evStat('👥 총 회원', total) +
    evStat('✅ 참석',    attend,   'green') +
    evStat('❌ 불참',    absent,   'red') +
    evStat('❓ 미정',    undecided,'amber') +
    evStat('💳 납부',    paid,     'green') +
    evStat('🔴 미납',    unpaid,   'red') +
    (exempt ? evStat('⭕ 면제', exempt, 'amber') : '') +
    '</div>' +
    /* 회원 리스트 */
    '<div class="ea-list-hdr">' +
    '<span class="tbl-hdr-title">👥 회원별 참석·납부 관리</span>' +
    '<span class="res-badge">'+total+'명</span>' +
    '</div>' +
    (list.length ?
      '<div class="ea-list">' + rows + '</div>' :
      '<div class="empty"><div class="empty-icon">👥</div><div class="empty-title">MEMBERS 시트에 회원 데이터를 등록하세요</div></div>'
    ) +
    /* [v4.6] 행사 사진 배너 — 비동기 로딩 플레이스홀더 */
    '<div id="eventPhotoSection" class="event-photo-section">' +
    '<div class="ep-loading"><div class="mini-spin"></div> 사진 불러오는 중...</div>' +
    '</div>' +
    '</div>';

  /* [v4.6] 참석 데이터 렌더 완료 후 사진 비동기 로딩 */
  if (S.currentEvent && S.currentEvent.name) {
    loadEventPhotos(S.currentEvent.name);
  }
}

function evStat(label, num, color) {
  var col = color==='green' ? 'var(--green)' : color==='red' ? 'var(--red)' : color==='amber' ? 'var(--amber)' : 'var(--n800)';
  return '<div class="ev-stat-item">' +
    '<div class="ev-stat-num" style="color:'+col+'">'+num+'</div>' +
    '<div class="ev-stat-label">'+label+'</div>' +
    '</div>';
}

/* ── 인덱스 기반 버튼 (onclick에 숫자 인덱스만 전달) ── */
function attendBtn(idx, a, status) {
  var isActive = (a.attend_status === status);
  return '<button class="ea-status-btn'+(isActive?' ea-btn-active-'+getAttendClass(status):''+'')+'" ' +
    'onclick="setAttendStatus('+idx+',this,\''+status+'\')">' +
    status + '</button>';
}
function payBtn(idx, a, status) {
  var isActive = (a.payment_status === status);
  return '<button class="ea-status-btn'+(isActive?' ea-btn-active-'+getPayClass(status):''+'')+'" ' +
    'onclick="setPayStatus('+idx+',this,\''+status+'\')">' +
    status + '</button>';
}
function getAttendClass(s) { return s==='참석'?'attend':s==='불참'?'absent':'undecided'; }
function getPayClass(s)    { return s==='납부'?'paid':s==='면제'?'exempt':'unpaid'; }

/**
 * [v4.3] 인덱스 기반 저장 — onclick에서 인덱스(숫자)만 받아
 * S.currentAttendList[idx]에서 member_id 등 실제 데이터를 조회
 * → 한국어/특수문자 포함 이름도 인코딩 문제 없이 전달
 */
function setAttendStatus(idx, btn, status) {
  if (!S.currentEvent || !S.currentAttendList) {
    toast('행사 정보가 없습니다. 새로고침 후 다시 시도해 주세요.', 'err'); return;
  }
  var a = S.currentAttendList[idx];
  if (!a) { toast('회원 정보를 찾을 수 없습니다.', 'err'); return; }

  // UI 즉시 업데이트
  var grp = $id('attend-grp-'+idx);
  if (grp) {
    grp.querySelectorAll('.ea-status-btn').forEach(function(b){ b.className = 'ea-status-btn'; });
    btn.className = 'ea-status-btn ea-btn-active-'+getAttendClass(status);
  }
  a.attend_status = status;

  btn.textContent = '저장중…'; btn.disabled = true;

  /* event_id 확인 */
  if (!S.currentEvent.id) {
    toast('저장 실패: event_id 누락 — 행사를 다시 선택해 주세요.', 'err');
    btn.textContent = status; btn.disabled = false; return;
  }

  /* member_id: 없으면 이름_기수 복합키 (Code.gs의 getEventAttend와 동일 규칙) */
  var effectiveMemberId = a.member_id || ((a.member_name||'') + '_' + (a.generation||''));
  if (!effectiveMemberId || effectiveMemberId === '_') {
    toast('저장 실패: member_id 없음 — MEMBER_MASTER에 이름 또는 기수를 입력해 주세요.', 'err');
    btn.textContent = status; btn.disabled = false; return;
  }

  API.saveEventAttend({
    event_id:      S.currentEvent.id,
    event_name:    S.currentEvent.name,
    member_id:     effectiveMemberId,
    member_name:   a.member_name,
    generation:    a.generation,
    phone:         a.phone,
    attend_status: status
  }).then(function(r){
    btn.textContent = status; btn.disabled = false;
    if (!r.success) {
      toast('저장 실패: ' + (r.error || '알 수 없는 오류'), 'err'); return;
    }
    toast('저장되었습니다 ✓ (' + (a.member_name||'') + ' 참석: ' + status + ')', 'ok');
  }).catch(function(e){
    btn.textContent = status; btn.disabled = false;
    toast('저장 오류: ' + e.message, 'err');
  });
}

function setPayStatus(idx, btn, status) {
  if (!S.currentEvent || !S.currentAttendList) {
    toast('행사 정보가 없습니다. 새로고침 후 다시 시도해 주세요.', 'err'); return;
  }
  var a = S.currentAttendList[idx];
  if (!a) { toast('회원 정보를 찾을 수 없습니다.', 'err'); return; }

  var grp = $id('pay-grp-'+idx);
  if (grp) {
    grp.querySelectorAll('.ea-status-btn').forEach(function(b){ b.className = 'ea-status-btn'; });
    btn.className = 'ea-status-btn ea-btn-active-'+getPayClass(status);
  }
  a.payment_status = status;

  btn.textContent = '저장중…'; btn.disabled = true;

  /* event_id 확인 */
  if (!S.currentEvent.id) {
    toast('저장 실패: event_id 누락 — 행사를 다시 선택해 주세요.', 'err');
    btn.textContent = status; btn.disabled = false; return;
  }

  /* member_id: 없으면 이름_기수 복합키 (Code.gs의 getEventAttend와 동일 규칙) */
  var effectivePayMemberId = a.member_id || ((a.member_name||'') + '_' + (a.generation||''));
  if (!effectivePayMemberId || effectivePayMemberId === '_') {
    toast('저장 실패: member_id 없음 — MEMBER_MASTER에 이름 또는 기수를 입력해 주세요.', 'err');
    btn.textContent = status; btn.disabled = false; return;
  }

  API.saveEventAttend({
    event_id:       S.currentEvent.id,
    event_name:     S.currentEvent.name,
    member_id:      effectivePayMemberId,
    member_name:    a.member_name,
    generation:     a.generation,
    phone:          a.phone,
    payment_status: status
  }).then(function(r){
    btn.textContent = status; btn.disabled = false;
    if (!r.success) {
      toast('저장 실패: ' + (r.error || '알 수 없는 오류'), 'err'); return;
    }
    toast('저장되었습니다 ✓ (' + (a.member_name||'') + ' 납부: ' + status + ')', 'ok');
  }).catch(function(e){
    btn.textContent = status; btn.disabled = false;
    toast('저장 오류: ' + e.message, 'err');
  });
}

function saveMemo(idx, memo) {
  if (!S.currentEvent || !S.currentAttendList) return;
  var a = S.currentAttendList[idx];
  if (!a) { toast('메모 저장 실패: 회원 정보 없음', 'err'); return; }
  var effectiveMemoMemberId = a.member_id || ((a.member_name||'') + '_' + (a.generation||''));
  if (!effectiveMemoMemberId || effectiveMemoMemberId === '_') {
    toast('메모 저장 실패: member_id 없음', 'err'); return;
  }
  a.memo = memo;
  API.saveEventAttend({
    event_id:    S.currentEvent.id,
    event_name:  S.currentEvent.name,
    member_id:   effectiveMemoMemberId,
    member_name: a.member_name,
    generation:  a.generation,
    phone:       a.phone,
    memo:        memo
  }).then(function(r){
    if (r.success) toast('저장되었습니다 ✓ (' + (a.member_name||'') + ' 메모)', 'ok');
    else toast('메모 저장 실패: ' + (r.error || ''), 'err');
  }).catch(function(e){ toast('저장 오류: ' + e.message, 'err'); });
}

/* 목록으로 돌아가기 */
function closeEventDetail() {
  var titleEl = $id('pageTitle'); if(titleEl) titleEl.textContent = '행사관리';
  var bcEl    = $id('pageBc');    if(bcEl)    bcEl.textContent    = '홈 / 행사관리';
  S.currentEvent = null;
  S.currentAttendList = [];
  buildEventsPage();
}

/* ═══════════════════════════════════════════════
   [v4.6] 행사 사진 갤러리 — loadEventPhotos / renderEventPhotos
   표시 위치: 행사 상세 운영 화면 하단 (#eventPhotoSection)
   대시보드에는 표시하지 않음
═══════════════════════════════════════════════ */

/**
 * 사진 목록 비동기 로딩 — event_name 기준으로 PHOTO_GALLERY 조회
 * @param {string} eventName  현재 행사명
 */
function loadEventPhotos(eventName) {
  var sec = $id('eventPhotoSection');
  if (!sec) return;

  API.getPhotoGallery(eventName)
    .then(function(d) {
      if (!d.success) { sec.innerHTML = ''; return; }
      renderEventPhotos(sec, d.photos || [], eventName);
    })
    .catch(function() { sec.innerHTML = ''; });
}

/**
 * 사진 갤러리 HTML 렌더링
 * @param {Element} sec       삽입 대상 DOM
 * @param {Array}   photos    사진 데이터 배열
 * @param {string}  eventName 행사명 (섹션 헤더 표시용)
 */
function renderEventPhotos(sec, photos, eventName) {
  if (!photos || !photos.length) {
    sec.innerHTML =
      '<div class="ep-empty">📷 등록된 행사 사진이 없습니다.</div>';
    return;
  }

  var cards = photos.map(function(p, i) {
    var imgUrl = normalizeImageUrl(p.image_url);
    return '<div class="event-photo-card" data-photo-idx="' + i + '">' +
      '<div class="event-photo-img-wrap">' +
      '<img class="event-photo-img" src="' + esc(imgUrl) + '" alt="' + esc(p.title) + '" ' +
      'loading="lazy" onerror="this.closest(\'.event-photo-card\').style.display=\'none\'">' +
      '<div class="ep-overlay"><span class="ep-zoom-icon">🔍</span></div>' +
      '</div>' +
      (p.title   ? '<div class="event-photo-title">'  + esc(p.title)   + '</div>' : '') +
      (p.photo_date ? '<div class="event-photo-date">' + esc(p.photo_date) + '</div>' : '') +
      (p.caption ? '<div class="event-photo-caption">' + esc(p.caption) + '</div>' : '') +
      '</div>';
  }).join('');

  sec.innerHTML =
    '<div class="ep-sec-lbl">📸 행사 사진 <span class="ep-count">' + photos.length + '장</span></div>' +
    '<div class="event-photo-grid" id="eventPhotoGrid">' + cards + '</div>';

  /* 사진 카드 클릭 → 모달 확대 */
  var grid = $id('eventPhotoGrid');
  if (grid) {
    grid.addEventListener('click', function(e) {
      var card = e.target.closest('[data-photo-idx]');
      if (!card) return;
      var idx = parseInt(card.getAttribute('data-photo-idx'));
      openPhotoModal(photos, idx);
    });
  }
}

/** 사진 전체화면 모달 */
var _photoList  = [];
var _photoIdx   = 0;

function openPhotoModal(photos, idx) {
  _photoList = photos;
  _photoIdx  = idx;
  var overlay = $id('photoModalOverlay');
  if (!overlay) return;
  showPhotoModal();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePhotoModal() {
  var overlay = $id('photoModalOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
function showPhotoModal() {
  var p      = _photoList[_photoIdx];
  var imgEl  = $id('photoModalImg');
  var ttlEl  = $id('photoModalTitle');
  var capEl  = $id('photoModalCaption');
  var dtEl   = $id('photoModalDate');
  var cntEl  = $id('photoModalCount');
  if (!p || !imgEl) return;
  imgEl.src = normalizeImageUrl(p.image_url);
  if (ttlEl)  ttlEl.textContent  = p.title   || '';
  if (capEl)  capEl.textContent  = p.caption || '';
  if (dtEl)   dtEl.textContent   = p.photo_date || '';
  if (cntEl)  cntEl.textContent  = (_photoIdx + 1) + ' / ' + _photoList.length;
}
function photoModalPrev() {
  if (_photoIdx > 0) { _photoIdx--; showPhotoModal(); }
}
function photoModalNext() {
  if (_photoIdx < _photoList.length - 1) { _photoIdx++; showPhotoModal(); }
}
function openSponsorModal() {
  var overlay = $id('sponsorModalOverlay');
  if (!overlay) return;

  // 행사 목록 옵션 생성
  var evOpts = '<option value="">행사 없음 (전체 공지)</option>' +
    S.events.map(function(e){
      return '<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>';
    }).join('');
  $id('sponEventSelect').innerHTML = evOpts;

  overlay.classList.add('open');
}
function closeSponsorModal() {
  var overlay = $id('sponsorModalOverlay');
  if (overlay) overlay.classList.remove('open');
}
function saveSponsorForm() {
  var eventSel = $id('sponEventSelect');
  var selectedEvent = S.events.find(function(e){ return e.id === eventSel.value; }) || {};
  var data = {
    event_id:       eventSel.value || '',
    event_name:     selectedEvent.name || '',
    sponsor_name:   ($id('sponName').value || '').trim(),
    generation:     ($id('sponGeneration').value || '').trim(),
    sponsor_type:   $id('sponType').value || '기타',
    sponsor_amount: ($id('sponAmount').value || '').trim(),
    notice_message: ($id('sponMessage').value || '').trim(),
    is_active:      'Y',
    display_order:  99,
    updated_by:     'admin'
  };
  if (!data.sponsor_name || !data.notice_message) {
    toast('찬조자명과 감사 문구는 필수입니다.','err'); return;
  }
  var saveBtn = $id('sponSaveBtn');
  if(saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '저장 중...'; }
  API.saveSponsorNotice(data)
    .then(function(r){
      if(saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '등록'; }
      if (!r.success) { toast('저장 실패: '+(r.error||''),'err'); return; }
      toast('찬조 감사 문구가 등록되었습니다.','ok');
      closeSponsorModal();
      // 대시보드 캐시 초기화 → 다음 접속 시 전광판 갱신
      S.dashboard = null; S.sponsorNotices = [];
    })
    .catch(function(e){
      if(saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '등록'; }
      toast(e.message,'err');
    });
}

/* ═══════════════════════════════════════════════
   회비 미납 현황 (기존 유지)
═══════════════════════════════════════════════ */
function renderUnpaid() {
  API.unpaid().then(function(d){
    if(!d.success){ setContent(errHtml(d.error)); return; }
    S.unpaid = d.members||[];
    var fee = CFG.ANNUAL_FEE||0;
    var totalAmt = S.unpaid.length*fee;

    setContent(
      '<div class="prog-card">' +
      '<div class="prog-title">⚠️ 회비 미납 현황</div>' +
      '<div class="prog-stats">' +
      '<div><div class="prog-main" style="color:#fca5a5">'+S.unpaid.length+'<span class="prog-unit" style="color:#f87171">명</span></div></div>' +
      '<div class="prog-detail">회비 미납 회원 목록입니다.<br/>' +
      (fee?'예상 미수금: <strong style="color:#fcd34d">'+fmtMoney(totalAmt)+'</strong>':'회비 금액은 config.js에서 설정하세요.') +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">' +
      '<div style="flex:1;font-size:.85rem;color:var(--gr600)">미납 회원 <strong>'+S.unpaid.length+'명</strong>' +
      (fee?' · 미수 예상 <span style="color:var(--g600);font-weight:700">'+fmtMoney(totalAmt)+'</span>':'') +
      '</div>' +
      '<button class="btn btn-gold btn-sm" onclick="exportCSV()">📥 CSV 다운로드</button>' +
      '<button class="btn btn-outline btn-sm" onclick="copyList()">📋 클립보드 복사</button>' +
      '</div>' +
      '<div class="tbl-card">' +
      '<div class="tbl-hdr"><span class="tbl-hdr-title">⚠️ 회비 미납 회원 목록</span><span class="res-badge">'+S.unpaid.length+'명</span></div>' +
      '<div class="tbl-scroll"><table>' +
      '<thead><tr><th>이름</th><th>기수</th><th>연락처</th><th>이메일</th><th>현소속</th><th>주소</th><th style="text-align:center">상세</th></tr></thead>' +
      '<tbody>' +
      (S.unpaid.length
        ? S.unpaid.map(function(m){
          var ph=m.phone?'<a class="lk-phone" href="tel:'+esc(m.phone)+'">'+esc(fmtPhone(m.phone))+'</a>':'—';
          var em=m.email?'<a class="lk-email" href="mailto:'+esc(m.email)+'">'+esc(m.email)+'</a>':'—';
          return '<tr><td class="td-name">'+esc(m.name||'—')+'</td><td class="td-num">'+esc(m.gradYear||'—')+'</td>' +
            '<td>'+ph+'</td><td><span class="truncate">'+em+'</span></td>' +
            '<td><span class="truncate">'+esc(m.org||'—')+'</span></td>' +
            '<td><span class="truncate">'+esc(m.address||'—')+'</span></td>' +
            '<td class="td-c"><button class="btn btn-primary btn-sm" onclick="openModal('+m.rowIndex+')">상세</button></td></tr>';
        }).join('')
        : tblEmpty('🎉 회비 미납 회원이 없습니다')
      ) +
      '</tbody>' +
      '</table></div>' +
      '</div>'
    );
  }).catch(function(e){ setContent(errHtml(e.message)); });
}

function exportCSV() {
  if(!S.unpaid.length){ toast('미납 회원 데이터가 없습니다','err'); return; }
  var hdr=['이름','기수','연락처','이메일','현소속','주소록'];
  var rows=S.unpaid.map(function(m){
    return [m.name,m.gradYear,fmtPhone(m.phone),m.email,m.org,m.address]
      .map(function(v){ return '"'+String(v||'').replace(/"/g,'""')+'"'; }).join(',');
  });
  var csv='\uFEFF'+[hdr.join(',')].concat(rows).join('\r\n');
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='JLAB_회비미납회원_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  toast('CSV 다운로드 완료','ok');
}
function copyList() {
  if(!S.unpaid.length){ toast('미납 회원 데이터가 없습니다','err'); return; }
  var txt=S.unpaid.map(function(m,i){
    return (i+1)+'. '+(m.name||'—')+' ('+(m.gradYear||'—')+'기) '+(m.phone?fmtPhone(m.phone):'—');
  }).join('\n');
  navigator.clipboard.writeText(txt)
    .then(function(){ toast(S.unpaid.length+'명 클립보드 복사 완료','ok'); })
    .catch(function(){ toast('클립보드 복사 실패','err'); });
}

/* ═══════════════════════════════════════════════
   회원 상세 모달 (기존 유지)
═══════════════════════════════════════════════ */
function openModal(rowIndex) {
  setModalLoad();
  $id('modalOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  API.detail(rowIndex).then(function(d){
    if(!d.success||!d.member){ toast('회원 정보 로드 실패','err'); return; }
    fillModal(d.member);
  }).catch(function(e){ toast(e.message,'err'); });
}
function closeModal() { $id('modalOverlay').classList.remove('open'); document.body.style.overflow=''; }
function setModalLoad() {
  $id('modalName').textContent='로딩 중...';
  $id('modalMeta').textContent='—';
  $id('modalAvatar').textContent='J';
  $id('modalBody').innerHTML='<div class="il-load"><div class="mini-spin"></div>회원 정보를 불러오는 중...</div>';
}
function fillModal(m) {
  $id('modalName').textContent=m.name||'(이름 없음)';
  $id('modalMeta').textContent=[m.gradYear?m.gradYear+'년도 졸업':'',m.org].filter(Boolean).join(' · ')||'—';
  $id('modalAvatar').textContent=initial(m.name);
  var ph=m.phone?'<a class="lk-phone" href="tel:'+esc(m.phone)+'">'+esc(fmtPhone(m.phone))+'</a>':'<em class="mf-empty">—</em>';
  var em=m.email?'<a class="lk-email" href="mailto:'+esc(m.email)+'">'+esc(m.email)+'</a>':'<em class="mf-empty">—</em>';
  $id('modalBody').innerHTML=
    '<div class="modal-sec-lbl">기본 정보</div>' +
    '<div class="modal-grid">' +
    mf('졸업연도',esc(m.gradYear)||'—') + mf('현소속',esc(m.org)||'—') +
    mf('연락처',ph) + mf('이메일',em,true) +
    mf('회비납부',feeBadge(m.feePaid)) +
    '</div>' +
    '<div class="modal-sec-lbl">추가 정보</div>' +
    '<div class="modal-grid">' +
    mf('주소록',esc(m.address)||'<em class="mf-empty">—</em>',true) +
    mf('특이사항',esc(m.note)||'<em class="mf-empty">—</em>',true) +
    mf('최종동기화',esc(m.syncDate)||'<em class="mf-empty">—</em>') +
    mf('회원ID',esc(m.id)||'<em class="mf-empty">—</em>') +
    '</div>';
}
function mf(lbl,valHtml,full){ return '<div class="'+(full?'m-fl':'')+'"><div class="mf-lbl">'+lbl+'</div><div class="mf-val">'+valHtml+'</div></div>'; }

/* ─── 사이드바 ───────────────────────────────── */
function openSidebar()  { $id('sidebar').classList.add('open'); $id('sidebarOverlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeSidebar() { $id('sidebar').classList.remove('open'); $id('sidebarOverlay').classList.remove('open'); document.body.style.overflow=''; }
function setSyncText() {
  var t = new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  var el = $id('syncText'); if(el) el.textContent='동기화: '+t;
}

/* ─── 초기화 ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  var name = CFG.ORG_NAME || 'J_LAB';
  var sub  = CFG.ORG_SUB  || '회원관리 시스템';

  ['brandOrgName','headerOrgPill'].forEach(function(id){ var el=$id(id); if(el) el.textContent=name; });
  var subEl  = $id('brandOrgSub');   if(subEl)  subEl.textContent=sub;
  var logoEl = $id('brandLogoText'); if(logoEl) logoEl.textContent=(name||'J').charAt(0);
  document.title = name+' 회원관리';

  document.querySelectorAll('[data-page]').forEach(function(btn){
    btn.addEventListener('click',function(){ navigate(this.getAttribute('data-page')); });
  });

  var mt = $id('menuToggle'); if(mt) mt.addEventListener('click',openSidebar);
  var so = $id('sidebarOverlay'); if(so) so.addEventListener('click',closeSidebar);

  var rb = $id('btnRefresh');
  if(rb) rb.addEventListener('click',function(){
    S.dashboard=null; S.members=[]; S.gradYears=[]; S.regions=[]; S.events=[]; S.notices=[]; S.sponsorNotices=[];
    toast('새로고침 중...'); renderPage(S.page);
  });

  $id('modalClose').addEventListener('click', closeModal);
  $id('modalOverlay').addEventListener('click',function(e){ if(e.target===this) closeModal(); });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape') { closeModal(); closeSponsorModal(); }
  });

  // 찬조 등록 모달 닫기 버튼
  var sponClose = $id('sponsorModalClose');
  if(sponClose) sponClose.addEventListener('click', closeSponsorModal);
  var sponOverlay = $id('sponsorModalOverlay');
  if(sponOverlay) sponOverlay.addEventListener('click',function(e){ if(e.target===this) closeSponsorModal(); });

  /* [v4.6] 사진 모달 이벤트 바인딩 */
  var photoOverlay = $id('photoModalOverlay');
  if(photoOverlay) photoOverlay.addEventListener('click', function(e){ if(e.target===this) closePhotoModal(); });
  var photoClose = $id('photoModalClose');
  if(photoClose) photoClose.addEventListener('click', closePhotoModal);
  var photoPrev  = $id('photoModalPrev');
  if(photoPrev)  photoPrev.addEventListener('click',  photoModalPrev);
  var photoNext  = $id('photoModalNext');
  if(photoNext)  photoNext.addEventListener('click',  photoModalNext);
  /* 키보드: ESC 닫기, 좌우 화살표 이동 */
  document.addEventListener('keydown', function(e) {
    if (!$id('photoModalOverlay') || !$id('photoModalOverlay').classList.contains('open')) return;
    if (e.key === 'ArrowLeft')  photoModalPrev();
    if (e.key === 'ArrowRight') photoModalNext();
  });

  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(function(){}); }

  navigate('dashboard');
});
