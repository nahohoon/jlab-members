# J_LAB 회원관리 시스템 v2.0

> CEO포럼·협회급 프리미엄 회원관리 웹앱  
> Google Sheets + Apps Script + GitHub Pages 기반

---

## 📁 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 HTML 구조 (SPA 셸) |
| `style.css` | 프리미엄 CSS (네이비·골드·화이트 테마) |
| `script.js` | 전체 앱 로직 (5개 페이지 SPA) |
| `config.js` | **★ API URL 설정 파일 (이것만 수정)** |
| `manifest.json` | PWA 홈화면 설치 설정 |
| `sw.js` | 오프라인 캐시 서비스워커 |

---

## ⚡ 빠른 시작 (3단계)

### 1단계 — Apps Script 배포 URL 확인
```
Google Sheets → 확장 프로그램 → Apps Script
→ 배포 → 배포 관리 → URL 복사
```

### 2단계 — config.js 수정
```javascript
// config.js 파일 열기 → API_URL 교체
API_URL: 'https://script.google.com/macros/s/여기에붙여넣기/exec',
```

### 3단계 — GitHub Pages 배포
```
1. GitHub 레포지토리 생성 (예: jlab-members)
2. 이 폴더의 모든 파일 업로드
3. Settings → Pages → Branch: main → Save
4. 1~2분 후 https://[계정명].github.io/[레포명]/ 접속
```

---

## 🖥️ 기능 목록

### 대시보드
- 총 회원수 / 회비 납부율 / 미납자 수 / 골프 참여자 수
- 기수별 현황 바 차트
- 납부율 도넛 차트

### 회원관리
- 통합 검색 (이름·연락처·이메일·소속·특이사항)
- 기수별 드롭다운 필터
- 지역별 드롭다운 필터
- 탭 필터 (전체 / 납부 / 미납 / 골프참여)
- 회원 목록 테이블
- 상세보기 모달 (전화·이메일 링크 포함)

### 회비관리
- 전체 납부율 프로그레스 카드
- 기수별 납부 현황 테이블
- 회원별 납부 상태 일람

### 행사관리
- EVENT_MASTER 시트 연동 행사 목록
- 행사 클릭 → 참석자 현황 조회
- EVENT_ATTEND 시트 연동

### 미납자 추출
- 미납자 목록 전체 표시
- CSV 다운로드 (엑셀 자동 인식 BOM 포함)
- 클립보드 복사 (문자 발송용)

---

## 📱 PWA 홈화면 설치

### iPhone (Safari)
```
Safari에서 사이트 접속 → 공유 버튼(□↑) → 홈 화면에 추가
```

### Android (Chrome)
```
Chrome에서 접속 → 주소창 우측 설치 아이콘 클릭
또는 메뉴 → 앱 설치
```

---

## 📋 Google Sheets 시트 구조

### MEMBER_MASTER (기존)
| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| 회원ID | 이름 | 졸업연도 | 연락처 | 이메일 | 현소속 | 회비납부 | 골프참여 | 특이사항 | 주소록 | 최종동기화일 |

### EVENT_MASTER (선택 — 행사관리 사용 시)
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| 행사ID | 행사명 | 행사일 | 장소 | 참가비 | 비고 |

### EVENT_ATTEND (선택 — 참석관리 사용 시)
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| 행사ID | 회원ID | 이름 | 참석여부(Y/N) | 납부여부(Y/N) | 비고 |

---

## ⚙️ config.js 전체 설정

```javascript
window.JLAB_CONFIG = {
  API_URL   : 'https://script.google.com/macros/s/YOUR_ID/exec', // ★필수
  ORG_NAME  : 'J_LAB',           // 앱 이름
  ORG_SUB   : '회원관리 시스템',  // 서브타이틀
  ORG_YEAR  : '2025',            // 기준 연도
  ANNUAL_FEE: 100000,            // 연간 회비(원), 0이면 금액 숨김
  VERSION   : '2.0.0'
};
```

---

## 🔒 Apps Script 배포 권한 설정

```
배포 설정:
- 유형: 웹 앱
- 다음 사용자로 실행: 나 (내 Google 계정)
- 액세스 권한: 조직 내 모든 사용자 또는 모든 사람
```

> **주의**: 외부 GitHub Pages에서 접근하려면 액세스를 **"모든 사람"** 으로 설정해야 합니다.

---

## 🎨 디자인 색상 커스터마이징

`style.css` 상단의 CSS 변수를 수정하면 전체 색상이 변경됩니다.

```css
:root {
  --n900: #0a1628;   /* 메인 네이비 */
  --g400: #c9a040;   /* 골드 액센트 */
  --b400: #2563eb;   /* 링크 블루 */
}
```

---

## 📞 문의 및 지원

- 시스템 버전: v2.0.0
- 최종 업데이트: 2025

---

*Built with Google Apps Script + GitHub Pages*
