/**
 * J_LAB 회원관리 v3.0 — script.js
 * GitHub Pages SPA | Apps Script API 연동
 * ─────────────────────────────────────────
 * 기반: GitHub 최신본 (2025-04-24 기준)
 * v3 추가:
 *   대시보드 개선 (공지사항·다가오는행사·빠른실행·미니카드·미납배너)
 *   회비 납부 상태 버튼 저장 (updateFeeStatus doPost)
 *   행사 참석/납부 저장 버튼 (updateEventAttend doPost)
 *   공지사항 조회 (getNotices)
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
    return fetch(url, {
      method:'POST', redirect:'follow',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    }).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
  },
  dash    : function()   { return API.call({ action:'getDashboard' }); },
  members : function(p)  { return API.call(Object.assign({ action:'getMembers' }, p)); },
  detail  : function(ri) { return API.call({ action:'getMemberDetail', rowIndex:ri }); },
  grads   : function()   { return API.call({ action:'getGradYears' }); },
  regions : function()   { return API.call({ action:'getRegions' }); },
  unpaid  : function()   { return API.call({ action:'getUnpaidMembers' }); },
  events  : function()   { return API.call({ action:'getEventList' }); },
  attend  : function(id) { return API.call({ action:'getEventAttendance', eventId:id }); },
  notices : function(n)  { return API.call({ action:'getNotices', limit:n||5 }); },
  /* 쓰기 */
  saveFee           : function(rowIndex, value) { return API.post({ action:'updateFeeStatus', rowIndex:rowIndex, value:value }); },
  saveEventAttend   : function(rowIndex, col, value) { return API.post({ action:'updateEventAttend', rowIndex:rowIndex, col:col, value:value }); },
  addEventAttend    : function(body) { return API.post(Object.assign({ action:'addEventAttend' }, body)); }
};

/* ─── 유틸 ───────────────────────────────────── */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function isFeeY(v)  { var s=String(v||'').trim().toLowerCase(); return s==='y'||s==='납부'||s==='완료'||s==='1'||s==='true'; }
function isAttnY(v) { var s=String(v||'').trim().toLowerCase(); return s==='y'||s==='참석'||s==='1'||s==='true'; }
function isImpY(v)  { var s=String(v||'').trim().toLowerCase(); return s==='y'||s==='중요'||s==='1'||s==='true'; }
function fmtPhone(p){ if(!p) return ''; return String(p).replace(/[^0-9]/g,'').replace(/^(\d{2,3})(\d{3,4})(\d{4})$/,'$1-$2-$3'); }
function fmtMoney(n){ return Number(n).toLocaleString('ko-KR')+'원'; }
function initial(name){ return name ? String(name).charAt(0) : 'J'; }
function feeBadge(v){ return isFeeY(v) ? '<span class="badge b-paid">✓ 납부</span>' : '<span class="badge b-unpaid">✗ 미납</span>'; }
function attnBadge(v){ return isAttnY(v) ? '<span class="badge b-attend">✓ 참석</span>' : '<span class="badge b-absent">✗ 불참</span>'; }

function parseEventDate(s) {
  if (!s) return null;
  var c = String(s).replace(/년\s*/g,'-').replace(/월\s*/g,'-').replace(/일/g,'').replace(/\./g,'-').replace(/\s+/g,'').replace(/-+$/,'');
  var d = new Date(c);
  return isNaN(d.getTime()) ? null : d;
}
function dDayTag(dateStr) {
  var d = parseEventDate(dateStr);
  if (!d) return '';
  var diff = Math.ceil((d.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return '<span class="day-tag day-today">오늘</span>';
  if (diff > 0)  return '<span class="day-tag day-coming">D-'+diff+'</span>';
  return '<span class="day-tag day-past">종료</span>';
}

function numAnim(el, target) {
  if (!el) return;
  var t0=null, dur=680;
  requestAnimationFrame(function step(ts){
    if(!t0) t0=ts;
    var p=Math.min((ts-t0)/dur,1);
    el.textContent=Math.round(p*target);
    if(p<1) requestAnimationFrame(step);
    else el.textContent=target;
  });
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

/* ─── Router ─────────────────────────────────── */
var PAGE_INFO = {
  dashboard : { title:'대시보드',       bc:'홈 / 대시보드' },
  members   : { title:'회원관리',       bc:'홈 / 회원관리' },
  fees      : { title:'회비관리',       bc:'홈 / 회비관리' },
  events    : { title:'행사관리',       bc:'홈 / 행사관리' },
  unpaid    : { title:'회비 미납 현황', bc:'홈 / 회비 미납 현황' }
};
function navigate(page) {
  S.page = page;
  var info = PAGE_INFO[page] || { title:page, bc:'홈 / '+page };
  var titleEl=$id('pageTitle'); if(titleEl) titleEl.textContent=info.title;
  var bcEl=$id('pageBc');       if(bcEl)    bcEl.textContent=info.bc;
  document.querySelectorAll('.nav-item').forEach(function(el){ el.classList.toggle('active', el.getAttribute('data-page')===page); });
  document.querySelectorAll('.bnav-item').forEach(function(el){ el.classList.toggle('active', el.getAttribute('data-page')===page); });
  closeSidebar();
  renderPage(page);
}
function renderPage(page) {
  setLoading();
  var map = { dashboard:renderDashboard, members:renderMembers, fees:renderFees, events:renderEvents, unpaid:renderUnpaid };
  if (map[page]) map[page]();
}

/* ═══════════════════════════════════════════════
   대시보드 — 운영자 중심 재구성
   ① 공지사항  ② 다가오는 행사
   ③ 빠른 실행 버튼 ④ 운영 요약 미니 카드
   ⑤ 회비 미납 배너
   ⑥ 데스크톱 전용: 기수별 현황 + 도넛 차트
═══════════════════════════════════════════════ */
function renderDashboard() {
  Promise.all([
    API.dash(),
    API.notices(3).catch(function(){ return {success:true,notices:[]}; })
  ])
  .then(function(res) {
    var d = res[0];
    if (!d.success) { setContent(errHtml(d.error)); return; }
    S.dashboard = d;
    var notices = (res[1].success && res[1].notices) ? res[1].notices : [];
    setSyncText();

    var fee     = CFG.ANNUAL_FEE || 0;
    var pct     = d.feeRate || 0;
    var upcoming = d.upcomingEvents || [];

    /* ① 공지사항 */
    var noticeHtml = '';
    if (notices.length) {
      noticeHtml =
        '<div class="dash-sec-lbl">📢 공지사항</div>' +
        '<div class="notice-list">' +
          notices.map(function(n) {
            var imp = isImpY(n.important);
            return '<div class="notice-item'+(imp?' notice-imp':'')+'">' +
              (imp ? '<span class="notice-badge">중요</span>' : '') +
              '<div class="notice-title">'+esc(n.title)+'</div>' +
              (n.body ? '<div class="notice-body">'+esc(n.body)+'</div>' : '') +
              '<div class="notice-date">'+esc(n.date)+'</div>' +
            '</div>';
          }).join('') +
        '</div>';
    }

    /* ② 다가오는 행사 */
    var upcomingHtml;
    if (upcoming.length) {
      upcomingHtml =
        '<div class="upcoming-list">' +
          upcoming.map(function(e) {
            return '<div class="upcoming-card">' +
              '<div class="uc-top">' +
                '<div class="uc-name">'+esc(e.name)+'</div>' +
                dDayTag(e.date) +
              '</div>' +
              '<div class="uc-meta">' +
                (e.date  ? '<span><span class="uc-ico">🗓</span>'+esc(e.date)+'</span>'  : '') +
                (e.venue ? '<span><span class="uc-ico">📍</span>'+esc(e.venue)+'</span>' : '') +
                (e.fee   ? '<span><span class="uc-ico">💰</span>'+esc(e.fee)+'</span>'   : '') +
              '</div>' +
              (e.note ? '<div class="uc-note">📝 '+esc(e.note)+'</div>' : '') +
            '</div>';
          }).join('') +
        '</div>';
    } else {
      upcomingHtml =
        '<div class="upcoming-empty">' +
          '<span style="font-size:1.4rem">📅</span>' +
          '<span>예정된 행사가 없습니다<br/>' +
            '<span style="font-size:.75rem;color:var(--gr400)">EVENT_MASTER 시트에 행사를 등록하세요</span>' +
          '</span>' +
        '</div>';
    }

    /* ③ 빠른 실행 버튼 */
    var quickHtml =
      '<div class="quick-grid">' +
        qBtn('👥','회원 검색','members') +
        qBtn('📅','행사 관리','events')  +
        qBtn('💰','회비 관리','fees')    +
        qBtn('⚠️','미납 현황','unpaid')  +
      '</div>';

    /* ④ 운영 요약 미니 카드 */
    var miniHtml =
      '<div class="mini-stat-row">' +
        mStat('총 회원수',  d.total,     '명', 'ms-total')  +
        mStat('회비 납부',  d.feePaid,   '명', 'ms-paid')   +
        mStat('회비 미납',  d.feeUnpaid, '명', 'ms-unpaid') +
      '</div>';

    /* ⑤ 미납 배너 */
    var unpaidBanner =
      '<div class="unpaid-banner" onclick="navigate(\'unpaid\')" role="button" tabindex="0">' +
        '<div class="ub-left">' +
          '<div class="ub-dot"></div>' +
          '<div>' +
            '<div class="ub-title">⚠️ 회비 미납 현황</div>' +
            '<div class="ub-desc">미납자 <strong>'+d.feeUnpaid+'명</strong>' +
              (fee ? ' &nbsp;·&nbsp; 예상 미수금 <strong>'+fmtMoney(d.feeUnpaid*fee)+'</strong>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="ub-arrow">›</div>' +
      '</div>';

    /* ⑥ 데스크톱 전용: 기수별 현황 + 도넛 */
    var maxGrad=1;
    (d.gradStats||[]).forEach(function(g){ if(g.count>maxGrad) maxGrad=g.count; });
    var gradBars=(d.gradStats||[]).map(function(g){
      var w=Math.round(g.count/maxGrad*100);
      return '<div class="grad-bar-item">' +
        '<div class="grad-bar-yr">'+esc(g.year)+'</div>' +
        '<div class="grad-bar-track"><div class="grad-bar-fill" style="width:'+w+'%"></div></div>' +
        '<div class="grad-bar-cnt">'+g.count+'</div></div>';
    }).join('');

    var desktopSection =
      '<div class="dash-row desk-only">' +
        '<div class="card">' +
          '<div class="card-hdr"><div class="card-title"><div class="card-icon">📊</div>기수별 회원 현황</div></div>' +
          '<div class="card-body">'+(gradBars||'<div class="empty" style="padding:24px"><div class="empty-icon">📋</div><div class="empty-title">기수 데이터 없음</div></div>')+'</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-hdr"><div class="card-title"><div class="card-icon">💰</div>회비 납부율</div></div>' +
          '<div class="card-body">' +
            '<div class="donut-wrap">' +
              '<div class="donut-ring" style="--pct:'+pct+'%">' +
                '<div class="donut-hole"><div class="donut-pct">'+pct+'<span style="font-size:.7rem">%</span></div><div class="donut-sub">납부율</div></div>' +
              '</div>' +
              '<div>' +
                '<div class="legend-item"><div class="legend-dot" style="background:var(--green)"></div>납부: <strong style="margin-left:4px">'+d.feePaid+'명</strong></div>' +
                '<div class="legend-item"><div class="legend-dot" style="background:var(--red)"></div>미납: <strong style="margin-left:4px">'+d.feeUnpaid+'명</strong></div>' +
                '<div class="legend-item"><div class="legend-dot" style="background:var(--gr300)"></div>전체: <strong style="margin-left:4px">'+d.total+'명</strong></div>' +
              '</div>' +
            '</div>' +
            '<div class="divider"></div>' +
            '<div class="prog-bar-track" style="height:10px"><div class="prog-bar-fill" style="width:'+pct+'%"></div></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    /* 최종 렌더 */
    setContent(
      '<div class="dash-greeting">' +
        '<h2>안녕하세요, <span class="dash-org">'+esc(CFG.ORG_NAME||'J_LAB')+'</span></h2>' +
        '<p>오늘의 운영 현황입니다.</p>' +
      '</div>' +
      noticeHtml +
      '<div class="dash-sec-lbl">📅 다가오는 행사</div>' + upcomingHtml +
      '<div class="dash-sec-lbl" style="margin-top:22px">⚡ 빠른 실행</div>' + quickHtml +
      miniHtml +
      unpaidBanner +
      desktopSection
    );
  })
  .catch(function(e){ setContent(errHtml(e.message)); });
}

function qBtn(icon, label, page) {
  return '<button class="quick-btn" onclick="navigate(\''+page+'\')">' +
    '<span class="qb-icon">'+icon+'</span><span class="qb-label">'+label+'</span></button>';
}
function mStat(label, num, unit, cls) {
  return '<div class="mini-stat '+cls+'">' +
    '<div class="ms-num">'+num+'<span class="ms-unit">'+unit+'</span></div>' +
    '<div class="ms-label">'+label+'</div>' +
  '</div>';
}
function sCard(cls, icon, numId, num, unit, label, sub) {
  return '<div class="stat-card '+cls+'">' +
    '<div class="stat-icon">'+icon+'</div>' +
    '<div class="stat-num"><span id="'+numId+'">'+num+'</span><span class="stat-unit">'+unit+'</span></div>' +
    '<div class="stat-label">'+label+'</div>' +
    (sub?'<div class="stat-sub">'+esc(sub)+'</div>':'') +
  '</div>';
}

/* ═══════════════════════════════════════════════
   회원관리
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
  var gOpts='<option value="">전체 기수</option>'+
    S.gradYears.map(function(y){ return '<option value="'+esc(y)+'"'+(S.filters.gradYear===y?' selected':'')+'>'+esc(y)+'년도</option>'; }).join('');
  var rOpts='<option value="">전체 지역</option>'+
    S.regions.map(function(r){ return '<option value="'+esc(r)+'"'+(S.filters.region===r?' selected':'')+'>'+esc(r)+'</option>'; }).join('');

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
  var si=$id('searchInput');
  if(si) si.addEventListener('input',function(){ clearTimeout(timer); var v=this.value; timer=setTimeout(function(){ S.filters.q=v.trim(); loadMemberTable(); },380); });
  var fg=$id('filterGrad'); if(fg) fg.addEventListener('change',function(){ S.filters.gradYear=this.value; loadMemberTable(); });
  var fr=$id('filterRegion'); if(fr) fr.addEventListener('change',function(){ S.filters.region=this.value; loadMemberTable(); });
  document.querySelectorAll('#ftabs .ftab').forEach(function(btn){
    btn.addEventListener('click',function(){
      S.filters.filter=this.getAttribute('data-f');
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
   회비관리 — 납부 상태 버튼 저장 포함
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

/* 회비 납부 상태 토글 저장 */
function toggleFee(btn, rowIndex, newVal) {
  btn.disabled = true;
  btn.textContent = '저장 중...';
  API.saveFee(rowIndex, newVal)
    .then(function(r) {
      if (!r.success) { toast('저장 실패: '+(r.error||''), 'err'); btn.disabled=false; btn.textContent=(newVal==='Y'?'✓ 납부처리':'↩ 미납처리'); return; }
      var badgeEl = $id('fee-badge-'+rowIndex);
      if (badgeEl) badgeEl.innerHTML = feeBadge(newVal==='Y'?'Y':'N');
      btn.textContent  = (newVal==='Y' ? '↩ 미납처리' : '✓ 납부처리');
      btn.className    = 'btn btn-xs '+(newVal==='Y' ? 'btn-fee-revert' : 'btn-fee-pay');
      btn.setAttribute('onclick', 'toggleFee(this,'+rowIndex+',\''+(newVal==='Y'?'N':'Y')+'\')');
      btn.disabled = false;
      toast((newVal==='Y'?'납부 처리':'미납 처리')+'되었습니다.', 'ok');
      S.dashboard = null; // 대시보드 캐시 초기화
    })
    .catch(function(e){ toast(e.message,'err'); btn.disabled=false; });
}

/* ═══════════════════════════════════════════════
   행사관리 — 참석/납부 저장 버튼 포함
═══════════════════════════════════════════════ */
function renderEvents() {
  API.events().then(function(d){
    S.events=(d.success&&d.events)?d.events:[];
    buildEventsPage();
  }).catch(function(e){ setContent(errHtml(e.message)); });
}
function buildEventsPage() {
  var hasSheet=S.events.length>0;
  var guide=!hasSheet?
    '<div class="notice-box"><div class="notice-box-title">📋 행사 시트 설정 안내</div>' +
    '<div class="notice-box-body">구글 시트에 <code>EVENT_MASTER</code> 시트를 추가하면 행사 목록이 자동 표시됩니다.<br/>' +
    '컬럼: <code>행사ID</code> · <code>행사명</code> · <code>행사일</code> · <code>장소</code> · <code>참가비</code> · <code>비고</code></div></div>' : '';

  var cards=S.events.map(function(e){
    return '<div class="event-card" onclick="loadAttend(\''+esc(e.id)+'\',\''+esc(e.name)+'\')">' +
      '<div class="ev-name">'+esc(e.name)+'</div>' +
      '<div class="ev-info">' +
        (e.date ?'<span>📅 '+esc(e.date)+'</span>':'') +
        (e.venue?'<span>📍 '+esc(e.venue)+'</span>':'') +
        (e.fee  ?'<span>💰 '+esc(e.fee)+'</span>':'') +
        (e.note ?'<span>📝 '+esc(e.note)+'</span>':'') +
      '</div>' +
      '<div class="ev-foot"><span class="ev-id-badge">ID: '+esc(e.id)+'</span><span class="ev-view">참석 조회 →</span></div>' +
    '</div>';
  }).join('');

  setContent(
    guide +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
      '<div style="font-size:.92rem;font-weight:700;color:var(--n800)">📅 행사 목록 ' +
        '<span style="color:var(--gr400);font-weight:500;font-size:.8rem">'+S.events.length+'건</span></div>' +
    '</div>' +
    (hasSheet ? '<div class="event-grid">'+cards+'</div>' :
      '<div class="empty"><div class="empty-icon">📅</div><div class="empty-title">등록된 행사가 없습니다</div><div class="empty-desc">EVENT_MASTER 시트에 행사를 등록하세요.</div></div>') +
    '<div id="attendSec"></div>'
  );
}

function loadAttend(eventId, eventName) {
  var sec=$id('attendSec'); if(!sec) return;
  sec.innerHTML='<div class="il-load" style="margin-top:16px"><div class="mini-spin"></div>참석 정보 로딩 중...</div>';
  API.attend(eventId).then(function(d){
    var list=(d.success&&d.attendance)?d.attendance:[];
    var attn=list.filter(function(a){ return isAttnY(a.attended); }).length;
    var paid=list.filter(function(a){ return isFeeY(a.paid); }).length;

    sec.innerHTML=
      '<div class="tbl-card" style="margin-top:16px">' +
        '<div class="tbl-hdr">' +
          '<div class="tbl-hdr-title">👥 '+esc(eventName)+' — 참석 현황</div>' +
          '<div style="display:flex;gap:6px">' +
            '<span class="badge b-attend">참석 '+attn+'</span>' +
            '<span class="badge b-paid">납부 '+paid+'</span>' +
            '<span class="res-badge">전체 '+list.length+'</span>' +
          '</div>' +
        '</div>' +
        '<div class="tbl-scroll"><table>' +
          '<thead><tr><th>이름</th><th>회원ID</th>' +
            '<th class="th-gold">참석여부</th><th class="th-gold">납부여부</th><th>비고</th></tr></thead>' +
          '<tbody>' +
            (list.length
              ? list.map(function(a){
                  var aY=isAttnY(a.attended), pY=isFeeY(a.paid);
                  return '<tr id="ar-'+a.rowIndex+'">' +
                    '<td class="td-name">'+esc(a.name||'—')+'</td>' +
                    '<td class="td-num">'+esc(a.memberId||'—')+'</td>' +
                    '<td>' +
                      '<div style="display:flex;align-items:center;gap:6px">' +
                        '<span id="at-badge-'+a.rowIndex+'">'+attnBadge(a.attended)+'</span>' +
                        '<button class="btn btn-xs '+(aY?'btn-fee-revert':'btn-fee-pay')+'" ' +
                          'onclick="toggleAttend(this,'+a.rowIndex+',4,\''+(aY?'N':'Y')+'\')">' +
                          (aY?'↩':'✓') +
                        '</button>' +
                      '</div>' +
                    '</td>' +
                    '<td>' +
                      '<div style="display:flex;align-items:center;gap:6px">' +
                        '<span id="ap-badge-'+a.rowIndex+'">'+feeBadge(a.paid)+'</span>' +
                        '<button class="btn btn-xs '+(pY?'btn-fee-revert':'btn-fee-pay')+'" ' +
                          'onclick="toggleAttend(this,'+a.rowIndex+',5,\''+(pY?'N':'Y')+'\')">' +
                          (pY?'↩':'✓') +
                        '</button>' +
                      '</div>' +
                    '</td>' +
                    '<td style="color:var(--gr500);font-size:.82rem">'+esc(a.note||'—')+'</td>' +
                  '</tr>';
                }).join('')
              : tblEmpty('참석 데이터가 없습니다')
            ) +
          '</tbody>' +
        '</table></div>' +
      '</div>';
  }).catch(function(e){ sec.innerHTML='<div style="padding:16px;color:var(--red)">'+esc(e.message)+'</div>'; });
}

/* 행사 참석/납부 토글 저장 */
function toggleAttend(btn, rowIndex, col, newVal) {
  btn.disabled = true; btn.textContent='…';
  API.saveEventAttend(rowIndex, col, newVal)
    .then(function(r){
      if (!r.success) { toast('저장 실패: '+(r.error||''),'err'); btn.disabled=false; return; }
      if (col === 4) {
        var bdg=$id('at-badge-'+rowIndex); if(bdg) bdg.innerHTML=attnBadge(newVal);
        btn.className='btn btn-xs '+(newVal==='Y'?'btn-fee-revert':'btn-fee-pay');
        btn.setAttribute('onclick','toggleAttend(this,'+rowIndex+',4,\''+(newVal==='Y'?'N':'Y')+'\')');
        btn.textContent=(newVal==='Y'?'↩':'✓');
      } else {
        var bdg2=$id('ap-badge-'+rowIndex); if(bdg2) bdg2.innerHTML=feeBadge(newVal);
        btn.className='btn btn-xs '+(newVal==='Y'?'btn-fee-revert':'btn-fee-pay');
        btn.setAttribute('onclick','toggleAttend(this,'+rowIndex+',5,\''+(newVal==='Y'?'N':'Y')+'\')');
        btn.textContent=(newVal==='Y'?'↩':'✓');
      }
      btn.disabled=false;
      toast('저장되었습니다.','ok');
    })
    .catch(function(e){ toast(e.message,'err'); btn.disabled=false; });
}

/* ═══════════════════════════════════════════════
   회비 미납 현황
═══════════════════════════════════════════════ */
function renderUnpaid() {
  API.unpaid().then(function(d){
    if(!d.success){ setContent(errHtml(d.error)); return; }
    S.unpaid=d.members||[];
    var fee=CFG.ANNUAL_FEE||0;
    var totalAmt=S.unpaid.length*fee;

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
    return (i+1)+'. '+(m.name||'—')+' ('+(m.gradYear||'—')+'년도) '+(m.phone?fmtPhone(m.phone):'—');
  }).join('\n');
  navigator.clipboard.writeText(txt)
    .then(function(){ toast(S.unpaid.length+'명 클립보드 복사 완료','ok'); })
    .catch(function(){ toast('클립보드 복사 실패','err'); });
}

/* ═══════════════════════════════════════════════
   회원 상세 모달
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
  var t=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  var el=$id('syncText'); if(el) el.textContent='동기화: '+t;
}

/* ─── 초기화 ─────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  var name=CFG.ORG_NAME||'J_LAB';
  var sub=CFG.ORG_SUB||'회원관리 시스템';
  ['brandOrgName','headerOrgPill'].forEach(function(id){ var el=$id(id); if(el) el.textContent=name; });
  var subEl=$id('brandOrgSub'); if(subEl) subEl.textContent=sub;
  var logoEl=$id('brandLogoText'); if(logoEl) logoEl.textContent=(name||'J').charAt(0);
  document.title=name+' 회원관리';

  document.querySelectorAll('[data-page]').forEach(function(btn){
    btn.addEventListener('click',function(){ navigate(this.getAttribute('data-page')); });
  });
  var mt=$id('menuToggle'); if(mt) mt.addEventListener('click',openSidebar);
  var so=$id('sidebarOverlay'); if(so) so.addEventListener('click',closeSidebar);
  var rb=$id('btnRefresh');
  if(rb) rb.addEventListener('click',function(){
    S.dashboard=null; S.members=[]; S.gradYears=[]; S.regions=[]; S.events=[]; S.notices=[];
    toast('새로고침 중...'); renderPage(S.page);
  });
  $id('modalClose').addEventListener('click',closeModal);
  $id('modalOverlay').addEventListener('click',function(e){ if(e.target===this) closeModal(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeModal(); });
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(function(){}); }
  navigate('dashboard');
});
