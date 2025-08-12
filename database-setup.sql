-- 나는솔로 뉴스 수집 시스템 데이터베이스 스키마 (간소화 버전)
-- Supabase SQL Editor에서 실행

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- === 기사 테이블: 수집된 나는솔로 기사들 ===
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,                   -- 기사 제목
  summary TEXT,                          -- 기사 요약
  original_url TEXT NOT NULL,            -- 원본 기사 URL
  canonical_url TEXT,                    -- 정규화된 URL
  thumbnail_url TEXT,                    -- 썸네일 이미지 URL
  author TEXT,                           -- 기사 작성자/언론사
  published_at TIMESTAMPTZ,              -- 실제 발행일
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- 수집일
  status TEXT NOT NULL DEFAULT 'pending', -- 상태 ('pending' 고정)
  raw_meta JSONB,                        -- 수집 메타데이터
  hash TEXT NOT NULL,                    -- 중복 방지 해시
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- === 성능 최적화 인덱스 ===
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_articles_created ON public.articles(created_at DESC);

-- 중복 방지를 위한 유니크 인덱스 (가장 중요!)
CREATE UNIQUE INDEX IF NOT EXISTS ux_articles_hash ON public.articles(hash);

-- === 보안 설정 (Row Level Security) ===
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책: 모든 기사 (나는솔로 전용이므로)
CREATE POLICY "Public read access to articles" ON public.articles
  FOR SELECT USING (true);

-- 서비스 역할 전체 접근 권한 (Edge Function용)
CREATE POLICY "Service role full access to articles" ON public.articles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- === 권한 부여 ===
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.articles TO anon, authenticated;

-- 서비스 역할 전체 권한
GRANT ALL ON public.articles TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- === 검증 쿼리 ===
-- 설정 확인용 (주석 해제해서 실행)
-- SELECT '수집된 기사 수:', COUNT(*) FROM public.articles;
-- SELECT '최신 기사 5개:', title FROM public.articles ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 5;