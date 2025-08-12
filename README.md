# 나는솔로 뉴스 수집 시스템 💕

나는솔로 출연자들의 최신 소식을 네이버 뉴스에서 실시간으로 수집하는 Next.js 기반 웹 애플리케이션입니다.

## ✨ 주요 기능

- **🔄 실시간 뉴스 수집**: 네이버 뉴스에서 "나는솔로" 관련 기사 자동 수집
- **💕 나는솔로 전용**: 나는솔로 프로그램과 출연자 관련 뉴스만 엄격하게 필터링
- **🚫 중복 방지**: SHA-256 해시 기반 중복 기사 자동 제거
- **📱 반응형 UI**: 모바일과 데스크톱에서 모두 최적화된 사용자 경험
- **⚡ 실시간 업데이트**: 수집 완료 후 자동으로 최신 기사 목록 갱신

## 🏗️ 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript 5, Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Deployment**: Vercel (Frontend) + Supabase (Backend)
- **Data Collection**: 웹 스크래핑 (Fetch + 정규식)

## 🚀 빠른 시작

### 1. 환경 설정

`.env.local` 파일 생성:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 데이터베이스 설정

Supabase SQL Editor에서 `database-setup.sql` 실행

### 4. Edge Function 배포

```bash
# Supabase CLI 설치 후
npx supabase functions deploy crawl_manual
```

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인

## 📁 프로젝트 구조

```
my-project/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   │   ├── articles/      # 기사 조회 API
│   │   └── crawl/manual/  # 수집 실행 API
│   ├── globals.css        # 글로벌 스타일
│   ├── layout.tsx         # 루트 레이아웃
│   └── page.tsx           # 메인 페이지
├── supabase/functions/    # Edge Functions
│   └── crawl_manual/      # 뉴스 수집 함수
├── database-setup.sql     # 데이터베이스 스키마
└── README.md             # 이 파일
```

## 💾 데이터베이스 스키마

### `sources` 테이블
- 뉴스 수집 소스 관리
- 현재: 네이버 뉴스 - 나는솔로 검색

### `articles` 테이블
- 수집된 나는솔로 기사들
- 제목, 요약, URL, 작성자, 발행일 등 저장
- 중복 방지를 위한 해시 필드

## 🔧 주요 컴포넌트

### Edge Function (`supabase/functions/crawl_manual/index.ts`)
- 네이버 뉴스 스크래핑 로직
- HTML 파싱 및 데이터 추출
- 중복 검사 및 데이터베이스 저장

### API Routes
- `/api/crawl/manual`: 수집 실행 API
- `/api/articles`: 기사 조회 API

### Frontend (`app/page.tsx`)
- 나는솔로 전용 UI
- 수집 버튼 및 결과 표시
- 최신 기사 목록 (발행일 순)

## 🎯 수집 프로세스

1. **수집 시작**: 사용자가 "뉴스 수집 시작" 버튼 클릭
2. **네이버 검색**: `나는솔로` 키워드로 네이버 뉴스 검색
3. **HTML 파싱**: 검색 결과에서 기사 정보 추출
4. **필터링**: 나는솔로 관련 기사만 선별
5. **중복 검사**: 해시 기반 중복 기사 제거
6. **저장**: 데이터베이스에 새 기사 저장
7. **UI 업데이트**: 최신 기사 목록 자동 갱신

## 📋 개발 가이드

### 새로운 소스 추가
1. `sources` 테이블에 새 소스 추가
2. Edge Function에 해당 소스 처리 로직 구현
3. 테스트 후 배포

### 스타일링 수정
- Tailwind CSS 클래스 사용
- `app/globals.css`에서 커스텀 스타일 추가

### 데이터베이스 변경
- `database-setup.sql` 수정
- 마이그레이션 스크립트 작성

## 🛡️ 보안 고려사항

- **RLS 정책**: 데이터베이스 행 수준 보안 적용
- **서비스 키**: 서버 사이드에서만 사용, 클라이언트 노출 금지
- **CORS 설정**: 필요한 도메인만 허용

## 🔍 문제 해결

### 수집이 안 될 때
1. Edge Function 로그 확인: Supabase Dashboard > Edge Functions > Logs
2. 네이버 뉴스 구조 변경 확인
3. 정규식 패턴 업데이트 필요할 수 있음

### 빈 기사 목록
1. 데이터베이스에 소스가 있는지 확인
2. 소스가 `enabled = true`인지 확인
3. 수집 실행 후 오류 메시지 확인

## 📈 향후 개선사항

- **썸네일 이미지**: 기사 썸네일 표시 기능
- **실시간 알림**: 새 기사 등록 시 알림 기능
- **검색 기능**: 수집된 기사 내 검색
- **카테고리**: 출연자별, 시즌별 분류
- **스케줄링**: 자동 수집 스케줄 설정

## 📄 라이선스

MIT License

---

💕 **나는솔로 팬들을 위한 뉴스 수집 시스템** 💕