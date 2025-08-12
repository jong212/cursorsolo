"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

// === 타입 정의 ===
interface CollectionResult {
  inserted: number;
  total: number;
  skipped: number;
  errors: Array<{
    source_id: string;
    message: string;
  }>;
}

interface Article {
  id: string;
  title: string;
  summary?: string;
  original_url: string;
  author?: string;
  published_at?: string;
  sources: {
    name: string;
  };
}

interface ArticlesResponse {
  success: boolean;
  data: Article[];
  error?: string;
}

export default function NaEunSoloNewsPage() {
  // === 상태 관리 ===
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CollectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [articlesError, setArticlesError] = useState<string | null>(null);

  // === API 호출 함수들 ===
  const fetchArticles = async () => {
    setIsLoadingArticles(true);
    setArticlesError(null);
    
    try {
      const response = await fetch("/api/articles?limit=20");
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data: ArticlesResponse = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch articles");
      }
      
      setArticles(data.data);
    } catch (err) {
      setArticlesError(err instanceof Error ? err.message : "Failed to load articles");
    } finally {
      setIsLoadingArticles(false);
    }
  };

  const runCollection = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/crawl/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxPerSource: 10 })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      
      // 수집 성공 시 기사 목록 새로고침
      if (data.inserted > 0) {
        setTimeout(fetchArticles, 1000);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : "Collection failed");
    } finally {
      setIsRunning(false);
    }
  };

  // === 컴포넌트 마운트 시 기사 로드 ===
  useEffect(() => {
    fetchArticles();
  }, []);

  return (
    <div className="font-sans min-h-screen p-8 max-w-4xl mx-auto">
      {/* 헤더 */}
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="나는솔로 뉴스"
            width={120}
            height={24}
            priority
          />
          <span className="text-2xl">💕</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">나는솔로 뉴스 수집 시스템</h1>
        <p className="text-gray-600 dark:text-gray-400">
          나는솔로 출연자들의 최신 소식을 실시간으로 수집합니다
        </p>
      </header>

      {/* 수집 버튼 */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">🔄 뉴스 수집</h2>
            <button
              onClick={runCollection}
              disabled={isRunning}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                         text-white rounded-lg font-medium transition-colors
                         disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  수집 중...
                </>
              ) : (
                <>
                  <span>📰</span>
                  뉴스 수집 시작
                </>
              )}
            </button>
          </div>

          {/* 수집 결과 */}
          {result && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-3">
                ✅ 수집 완료
              </h3>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded border">
                  <div className="text-2xl font-bold text-green-600">{result.inserted}</div>
                  <div className="text-sm text-gray-600">새 기사</div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded border">
                  <div className="text-2xl font-bold text-blue-600">{result.total}</div>
                  <div className="text-sm text-gray-600">총 처리</div>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded border">
                  <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
                  <div className="text-sm text-gray-600">중복 제외</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                    ⚠️ 오류 발생 ({result.errors.length}개)
                  </h4>
                  <ul className="text-sm space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i} className="text-red-700 dark:text-red-300">
                        {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 오류 표시 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                ❌ 수집 실패
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>
      </div>

      {/* 수집된 기사 목록 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">📰 최신 나는솔로 뉴스</h2>
          <button
            onClick={fetchArticles}
            disabled={isLoadingArticles}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg 
                       hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingArticles ? "새로고침 중..." : "새로고침"}
          </button>
        </div>

        {/* 로딩 상태 */}
        {isLoadingArticles && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-600">기사를 불러오는 중...</span>
          </div>
        )}

        {/* 오류 상태 */}
        {articlesError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-300">
              ❌ 기사 로딩 실패: {articlesError}
            </p>
          </div>
        )}

        {/* 기사 목록 */}
        {!isLoadingArticles && !articlesError && (
          <div className="space-y-4">
            {articles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">📭 수집된 기사가 없습니다</p>
                <p className="text-sm">위의 "뉴스 수집 시작" 버튼을 눌러 최신 나는솔로 뉴스를 수집해보세요</p>
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-600 mb-4">
                  총 {articles.length}개의 기사 (발행일 최신순)
                </div>
                
                {articles.map((article) => (
                  <article
                    key={article.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 
                               hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="font-medium leading-relaxed flex-1">
                        <a
                          href={article.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-blue-600 dark:text-blue-400"
                        >
                          {article.title}
                        </a>
                      </h3>
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded flex-shrink-0">
                        {article.sources.name}
                      </span>
                    </div>

                    {article.summary && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                        {article.summary.length > 150 
                          ? `${article.summary.slice(0, 150)}...` 
                          : article.summary}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {article.author && (
                        <span>👤 {article.author}</span>
                      )}
                      {article.published_at && (
                        <span>📅 {new Date(article.published_at).toLocaleDateString('ko-KR')}</span>
                      )}
                    </div>
                  </article>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <footer className="mt-12 text-center text-sm text-gray-500">
        <p>💕 나는솔로 뉴스 수집 시스템 v2.0</p>
        <p className="mt-1">네이버 뉴스에서 실시간으로 나는솔로 관련 소식을 수집합니다</p>
      </footer>
    </div>
  );
}