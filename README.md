# J_LAB 회원관리 시스템

J_LAB 회원관리 시스템은 동문회, 박사과정 모임, 협회, CEO포럼, 골프모임 등 회원 기반 조직의 운영을 효율화하기 위해 제작된 웹 기반 회원관리 시스템입니다.

본 시스템은 GitHub Pages, Google Apps Script, Google Sheets를 기반으로 구성되어 있으며, 별도 서버 없이 회원관리, 공지사항, 행사관리, 회비관리, 참석/납부 체크, 찬조 감사 전광판, 사진갤러리 기능을 제공합니다.

---

## 1. 시스템 개요

J_LAB 회원관리 시스템은 다음과 같은 목적을 가지고 개발되었습니다.

- 회원명부를 웹과 모바일에서 쉽게 조회
- 회비 납부 및 미납 현황 관리
- 행사 일정 등록 및 참석/납부 상태 체크
- 행사 현장에서 휴대폰으로 참석 여부 관리
- 찬조자 감사 문구를 전광판 형태로 표시
- 행사 및 모임 사진을 사진갤러리로 관리
- 카카오톡 링크 공유 후 휴대폰 홈 화면에 앱처럼 설치 가능

---

## 2. 주요 기능

### 2.1 대시보드

- J_LAB 인사말 표시
- 찬조 감사 LED 전광판
- 최근 공지사항 표시
- 다가오는 행사 표시
- 빠른 실행 메뉴
- 총회원수, 회비 납부, 회비 미납 등 운영 요약
- 회비 미납 현황 바로가기

### 2.2 회원관리

- 회원명부 조회
- 이름, 기수, 연락처, 이메일, 소속, 주소, 특이사항 확인
- 회원 상세정보 모달 표시
- 기수 및 조건별 검색 가능

### 2.3 회비관리

- 회원별 회비 납부 여부 확인
- 회비 납부/미납 상태 관리
- 회비 미납 인원 및 예상 미수금 확인

### 2.4 회비 미납 현황

- 미납 회원 목록 확인
- 미납자 중심 관리 화면 제공
- 운영진이 회비 독려 대상자를 쉽게 파악 가능

### 2.5 행사관리

- 행사명, 행사일, 장소, 참가비, 비고 관리
- 행사 목록 표시
- 행사 상세화면 제공
- 회원별 참석/불참/미정 체크
- 회원별 납부/미납/면제 체크
- 참석 및 납부 상태 Google Sheets에 즉시 저장
- 다시 접속해도 저장값 유지

### 2.6 찬조 감사 전광판

- 찬조금, 물품, 식사, 경품 등 후원 내역 표시
- 대시보드 상단에 LED 전광판처럼 흐르는 문구 출력
- SPONSOR_NOTICE 시트의 활성 문구만 표시
- 찬조자 예우 및 추가 후원 유도 효과

### 2.7 사진갤러리

- 독립 메뉴로 사진갤러리 제공
- Google Drive 사진 링크 기반 표시
- 날짜별 사진 정리
- 최근 사진 및 전체 사진 확인
- 사진 클릭 시 확대 모달 표시
- 행사 사진, 모임 사진, 단체사진 등 관리 가능

### 2.8 모바일 앱처럼 사용

- GitHub Pages URL 접속
- 휴대폰 홈 화면에 추가 가능
- PWA 구조 적용
- Android 및 iPhone에서 앱처럼 사용 가능

---

## 3. 시스템 구조

본 시스템은 다음 구조로 운영됩니다.

```text
GitHub Pages
 ├─ index.html
 ├─ script.js
 ├─ style.css
 ├─ style_additions.css
 ├─ config.js
 ├─ manifest.json
 ├─ sw.js
 ├─ icon-192.png
 ├─ icon-512.png
 └─ apple-touch-icon.png

Google Apps Script
 └─ Code.gs

Google Sheets
 ├─ MEMBER_MASTER
 ├─ NOTICE_MASTER
 ├─ EVENT_MASTER
 ├─ EVENT_ATTEND
 ├─ EVENT_ATTEND_V2
 ├─ SPONSOR_NOTICE
 ├─ PHOTO_GALLERY
 └─ FEE_HISTORY
```

---

## 4. 사용 기술

- HTML
- CSS
- JavaScript
- GitHub Pages
- Google Apps Script
- Google Sheets
- Google Drive 이미지 링크
- PWA Manifest
- Service Worker

---

## 5. Google Sheets 시트 구조

### 5.1 MEMBER_MASTER

회원명부 원본 시트입니다.

주요 컬럼 예시:

```text
회원ID
이름
기수
연락처
이메일
현소속
회비납부
특이사항
주소
최종동기화
```

### 5.2 NOTICE_MASTER

공지사항 관리 시트입니다.

주요 컬럼 예시:

```text
공지ID
제목
내용
등록일
중요여부
표시여부
image_url
```

현재 운영 원칙상 대시보드 공지사항에는 이미지를 표시하지 않고, 공지 텍스트 중심으로 운영합니다.

### 5.3 EVENT_MASTER

행사 기본정보 관리 시트입니다.

주요 컬럼 예시:

```text
회원ID
행사명
행사일
장소
참가비
비고
image_url
```

행사 사진은 EVENT_MASTER가 아니라 PHOTO_GALLERY에서 관리하는 것을 기본 원칙으로 합니다.

### 5.4 EVENT_ATTEND_V2

행사 참석 및 납부 상태 저장 시트입니다.

컬럼 구조:

```text
attend_id
event_id
event_name
member_id
member_name
generation
phone
attend_status
payment_status
payment_amount
memo
updated_at
updated_by
```

저장 기준:

```text
event_id + member_id
```

회원ID가 없을 경우:

```text
회원명_기수
```

복합키를 사용합니다.

### 5.5 SPONSOR_NOTICE

찬조 감사 전광판용 시트입니다.

컬럼 구조:

```text
notice_id
event_id
event_name
sponsor_name
generation
sponsor_type
sponsor_amount
notice_message
is_active
display_order
created_at
updated_at
updated_by
```

is_active 값이 Y, y, TRUE, true, 1인 경우 전광판에 표시됩니다.

### 5.6 PHOTO_GALLERY

사진갤러리 관리 시트입니다.

1행은 시스템용 영문 헤더, 2행은 한글 설명행, 3행부터 실제 데이터로 사용합니다.

컬럼 구조:

```text
photo_id
title
event_name
photo_date
image_url
caption
is_active
display_order
created_at
```

예시:

```text
P001
스승의 날 골프대회 단체사진
스승의 날 골프대회
2026-05-14
Google Drive 공유 링크
세븐밸리 행사사진
Y
1
2026-05-14
```

---

## 6. 배포 구조

### 6.1 GitHub Pages 주소

```text
https://nahohoon.github.io/jlab-members/
```

### 6.2 Apps Script 연결

config.js 파일에서 Google Apps Script 웹앱 URL을 관리합니다.

예시:

```javascript
const API_URL = "https://script.google.com/macros/s/배포ID/exec";
```

Apps Script를 새 버전으로 배포하더라도 기존 웹앱 URL을 유지하면 config.js를 수정하지 않아도 됩니다.

---

## 7. PWA 설치 안내

본 시스템은 휴대폰 홈 화면에 앱처럼 추가할 수 있습니다.

### Android

```text
Chrome에서 접속
→ 오른쪽 위 점 3개
→ 홈 화면에 추가
```

### iPhone

```text
Safari에서 접속
→ 공유 버튼
→ 홈 화면에 추가
```

홈 화면에 추가하면 J_LAB 아이콘으로 바로 실행할 수 있습니다.

---

## 8. 카카오톡 공유 안내문

회원에게는 아래 문구로 안내할 수 있습니다.

```text
J_LAB 회원관리 시스템 접속 주소입니다.

https://nahohoon.github.io/jlab-members/

휴대폰에서 접속 후 “홈 화면에 추가”를 하시면 앱처럼 사용할 수 있습니다.

안드로이드: 크롬 → 점 3개 → 홈 화면에 추가
아이폰: Safari → 공유 버튼 → 홈 화면에 추가
```

---

## 9. 현재 적용 버전

현재 주요 완성 버전:

```text
v4.6.x
```

주요 완료 내용:

- 대시보드 구조 개선
- 모바일 공지사항 정렬 개선
- 빠른 실행 메뉴 정리
- 행사 참석/납부 저장 오류 해결
- 찬조 감사 전광판 추가
- 독립 사진갤러리 메뉴 추가
- PWA 설치 지원
- J 아이콘 기반 홈 화면 추가 지원

---

## 10. 운영 원칙

### 10.1 사진 등록 원칙

사진은 다음 시트에만 등록합니다.

```text
PHOTO_GALLERY
```

NOTICE_MASTER나 EVENT_MASTER에 이미지 링크를 넣으면 대시보드가 복잡해질 수 있으므로, 사진은 사진갤러리 전용 시트에서 관리하는 것을 원칙으로 합니다.

### 10.2 대시보드 운영 원칙

대시보드는 다음 정보 중심으로 운영합니다.

- 인사말
- 찬조 감사 전광판
- 공지사항
- 다가오는 행사
- 빠른 실행
- 운영 요약
- 회비 미납 현황

사진은 대시보드가 아니라 사진갤러리 메뉴에서 확인합니다.

### 10.3 행사 운영 원칙

행사 현장에서는 휴대폰으로 행사관리 화면에 접속하여 참석 및 납부 상태를 체크합니다.

- 참석
- 불참
- 미정
- 납부
- 미납
- 면제

입력된 값은 EVENT_ATTEND_V2에 저장됩니다.

---

## 11. 향후 개선 과제

향후 개선 가능한 기능은 다음과 같습니다.

- 관리자 로그인 기능 강화
- 회원별 권한 분리
- 회원 직접 행사 신청 기능
- 회비 납부 알림 자동화
- 카카오톡 알림 연동
- 행사별 참석자 명단 다운로드
- 사진 일괄 업로드 기능
- 고객별 테마 색상 변경 기능
- 단체명, 로고, 메뉴명 자동 변경 기능
- 고객 납품용 설치 마법사 구성

---

## 12. 상품화 방향

본 시스템은 J_LAB 내부 적용 사례를 기반으로 제작되었으며, 향후 다음 고객군에 맞춰 확장할 수 있습니다.

- 동문회
- 박사과정 모임
- CEO포럼
- 협회
- 골프모임
- 지역 단체
- 전문가 네트워크
- 소상공인 협업단체

고객별로 아래 항목만 변경하면 재사용할 수 있습니다.

```text
단체명
로고
회원명부
행사명
공지사항
회비 기준
사진갤러리
Apps Script URL
```

---

## 13. 백업 및 관리 권장사항

정기적으로 아래 자료를 백업합니다.

```text
1. GitHub 저장소 ZIP
2. Apps Script Code.gs
3. Google Sheets 원본
4. manifest.json
5. sw.js
6. 주요 화면 캡처
```

권장 백업 위치:

```text
Google Drive / J_LAB 회원관리 시스템_상품화 원본
```

---

## 14. 라이선스 및 사용 범위

본 시스템은 J_LAB 운영 및 유사 단체 회원관리 시스템 구축을 위한 내부 개발 원형입니다.

상업적 납품, 고객 맞춤형 구축, 유지관리 서비스로 확장 가능하며, 고객별 배포 시에는 단체명, 데이터 저장소, Apps Script URL을 분리하여 운영하는 것을 권장합니다.
