// 나는솔로 뉴스 수집 Edge Function
// @deno-types="https://esm.sh/@supabase/supabase-js@2/dist/module/index.d.ts"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Deno 환경에서 정상 작동
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Deno 전역 타입 선언
declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

// === 타입 정의 ===
interface Article {
  title: string;
  summary: string;
  original_url: string;
  canonical_url: string;
  author: string;
  published_at: string;
  fetched_at: string;
  status: "pending";
  raw_meta: {
    scrape_method: string;
    search_keyword: string;
    page: number;
    press?: string;
    thumbnail_url?: string;
  };
  hash: string;
}

interface CollectionRequest {
  maxItems?: number;
}

interface CollectionResponse {
  inserted: number;
  total: number;
  skipped: number;
  error?: string;
}

// === 유틸리티 함수들 ===
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractTextContent(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/&[^;]+;/g, ' ') // HTML 엔티티 제거
    .replace(/\s+/g, ' ') // 공백 정규화
    .trim();
}
function isValidNaEunSoloArticle(title: string, summary: string | null | undefined, url: string): boolean {
  // 기본 검증: title과 url이 유효한지 확인
  if (!title || typeof title !== 'string' || !url || typeof url !== 'string') {
    return false;
  }
  
  // 제목 길이 검증
  if (title.length <= 5 || title.length >= 500) {
    return false;
  }
  
  // 나는솔로 관련 키워드 검증
  const hasNaEunSoloKeyword = title.includes('나는솔로') || 
                              title.includes('나는 솔로') || 
                              (summary && (summary.includes('나는솔로') || summary.includes('나는 솔로')));
  
  if (!hasNaEunSoloKeyword) {
    return false;
  }
  
  // 제외할 키워드 검증
  const excludeKeywords = ['검색결과', '더보기', '광고'];
  if (excludeKeywords.some(keyword => title.includes(keyword))) {
    return false;
  }
  
  // URL 검증
  if (!url.startsWith('http') || url.includes('search.naver.com')) {
    return false;
  }
  
  return true;
}

// === 네이버 뉴스 스크래핑 (새로운 SDS 구조) ===
async function scrapeNaverNews(maxItems: number): Promise<Article[]> {
  console.log(`🚀 Starting Naver News scraping with new SDS structure`);
  
  const searchUrls = [
    'https://search.naver.com/search.naver?where=news&query=나솔&sort=1&start=1',
    'https://search.naver.com/search.naver?where=news&query=나는+솔로&sort=1&start=1',
    'https://search.naver.com/search.naver?where=news&query=나솔&sort=1&start=11'
  ];
  
  const articles: Article[] = [];
  
  for (let pageIndex = 0; pageIndex < searchUrls.length && articles.length < maxItems; pageIndex++) {
    const searchUrl = searchUrls[pageIndex];
    console.log(`📄 Fetching page ${pageIndex + 1}`);
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache'
        },
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        console.log(`❌ Page ${pageIndex + 1} failed: HTTP ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      console.log(`✅ Page ${pageIndex + 1} fetched, HTML length: ${html.length}`);
      
      // 새로운 SDS 컴포넌트 구조로 뉴스 아이템 추출
      // 각 뉴스 아이템은 JYgn_vFQHubpClbvwVL_ 클래스를 가진 div로 구분됨
      const newsItemPattern = /<div[^>]*class="[^"]*JYgn_vFQHubpClbvwVL_[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*JYgn_vFQHubpClbvwVL_[^"]*"|<\/div>\s*<\/div>\s*<\/div>)/gi;
      const newsItems = Array.from(html.matchAll(newsItemPattern));
      
      console.log(`📰 Found ${newsItems.length} potential SDS news items`);
      
      for (const newsItem of newsItems) {
        if (articles.length >= maxItems) break;
        
        const itemHtml = newsItem[1];
        
        // 제목과 URL을 함께 추출 (제목을 감싸는 a 태그에서)
        const titleUrlMatch = itemHtml.match(/<a[^>]*nocr="1"[^>]*href="([^"]*)"[^>]*target="_blank"[^>]*>[\s\S]*?<span[^>]*class="[^"]*sds-comps-text-type-headline1[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        
        // 요약 추출 (body1 타입의 span)
        const summaryMatch = itemHtml.match(/<span[^>]*class="[^"]*sds-comps-text-type-body1[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        
        // 언론사 추출 (언론사 링크)
        const pressMatch = itemHtml.match(/<span[^>]*class="[^"]*sds-comps-text-type-body2[^"]*sds-comps-text-weight-sm[^"]*"[^>]*>([^<]+)<\/span>/i);
        
        // 썸네일 이미지 추출
        const thumbnailMatch = itemHtml.match(/<img[^>]*width="104"[^>]*src="([^"]*)"[^>]*>/i);
        
        if (titleUrlMatch) {
          const url = titleUrlMatch[1];
          const titleText = extractTextContent(titleUrlMatch[2]);
          
          // 요약 텍스트 처리
          let summary = titleText;
          if (summaryMatch) {
            const summaryText = extractTextContent(summaryMatch[1]);
            if (summaryText.length > 10) {
              summary = summaryText.slice(0, 300);
            }
          }
          
          // 언론사 처리
          let author = '네이버뉴스';
          if (pressMatch) {
            const pressText = extractTextContent(pressMatch[1]);
            if (pressText && pressText.length > 0) {
              author = pressText;
            }
          }
          
          // 썸네일 URL 처리
          let thumbnailUrl = '';
          if (thumbnailMatch) {
            thumbnailUrl = thumbnailMatch[1];
          }
          
          // 나는솔로 관련 기사인지 검증
          if (isValidNaEunSoloArticle(titleText, summary, url)) {
            try {
              const hashInput = `${url}::${titleText}`;
              const hash = await sha256Hex(hashInput);
              
              const article: Article = {
                title: titleText.slice(0, 500),
                summary: summary.slice(0, 300),
                original_url: url,
                canonical_url: url,
                author: author.slice(0, 100),
                published_at: new Date().toISOString(),
                fetched_at: new Date().toISOString(),
                status: "pending",
                raw_meta: {
                  scrape_method: 'naver_sds_structure_v2',
                  search_keyword: '나는 솔로',
                  page: pageIndex + 1,
                  press: author,
                  thumbnail_url: thumbnailUrl
                },
                hash
              };
              
              articles.push(article);
              console.log(`✨ Added SDS article: ${titleText.slice(0, 60)}... [${author}]`);
              
            } catch (error) {
              console.error('❌ Error processing SDS article:', error);
              continue;
            }
          }
        }
      }
      
      // 백업 검색 (기존 구조 + 새로운 패턴들)
      if (articles.length < 3) {
        console.log(`🔍 Trying backup search patterns...`);
        
        const backupPatterns = [
          // 기존 구조 패턴
          /<a[^>]*class="[^"]*news_tit[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
          // SDS 구조 대체 패턴
          /<a[^>]*href="([^"]*)"[^>]*target="_blank"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?나는[\s\S]*?솔로[\s\S]*?)<\/span>/gi,
          // 일반적인 나는솔로 링크 패턴
          /<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?나는[\s\S]*?솔로[\s\S]*?)<\/a>/gi
        ];
        
        for (const pattern of backupPatterns) {
          const matches = Array.from(html.matchAll(pattern));
          
          for (const match of matches) {
            if (articles.length >= maxItems) break;
            
            const url = match[1];
            const titleText = extractTextContent(match[2]);
            
            if (titleText && url && 
                titleText.length > 5 && 
                titleText.length < 200 &&
                url.startsWith('http') &&
                !url.includes('search.naver.com') &&
                isValidNaEunSoloArticle(titleText, titleText, url)) {
              
              try {
                const hashInput = `${url}::${titleText}`;
                const hash = await sha256Hex(hashInput);
                
                const article: Article = {
                  title: titleText.slice(0, 500),
                  summary: titleText.slice(0, 200),
                  original_url: url,
                  canonical_url: url,
                  author: '네이버뉴스',
                  published_at: new Date().toISOString(),
                  fetched_at: new Date().toISOString(),
                  status: "pending",
                  raw_meta: {
                    scrape_method: 'backup_pattern_search_v2',
                    search_keyword: '나는 솔로',
                    page: pageIndex + 1
                  },
                  hash
                };
                
                articles.push(article);
                console.log(`🆘 Added backup article: ${titleText.slice(0, 50)}...`);
                
              } catch (error) {
                console.error('❌ Error processing backup article:', error);
                continue;
              }
            }
          }
        }
      }
      
    } catch (pageError) {
      console.error(`❌ Error fetching page ${pageIndex + 1}:`, pageError);
      continue;
    }
  }
  
  console.log(`🎉 Successfully scraped ${articles.length} valid 나는솔로 articles using SDS structure`);
  return articles;
}

// === 데이터베이스 처리 ===
async function insertArticles(supabase: any, articles: Article[]): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  
  for (const article of articles) {
    try {
      const { error } = await supabase
        .from("articles")
        .insert(article);
      
      if (error) {
        if (error.code === '23505') { // 중복 키 오류
          skipped++;
          console.log(`⏭️ Skipped duplicate: ${article.title.slice(0, 50)}...`);
        } else {
          throw error;
        }
      } else {
        inserted++;
        console.log(`✅ Inserted: ${article.title.slice(0, 50)}...`);
      }
    } catch (insertError) {
      console.error(`❌ Insert failed: ${article.title.slice(0, 50)}...`, insertError);
      skipped++;
    }
  }
  
  return { inserted, skipped };
}

// === 메인 Edge Function 핸들러 ===
Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 환경 변수 확인
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 요청 파라미터 파싱
    const body: CollectionRequest = await req.json().catch(() => ({}));
    const { maxItems = 20 } = body;

    console.log("🚀 Starting 나는솔로 news collection", { maxItems });

    // 네이버 뉴스 스크래핑 실행
    const articles = await scrapeNaverNews(maxItems);

    if (articles.length === 0) {
      console.log("⚠️ No valid articles found");
      return new Response(
        JSON.stringify({ 
          inserted: 0, total: 0, skipped: 0 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 기사 저장
    const { inserted, skipped } = await insertArticles(supabase, articles);

    const result: CollectionResponse = {
      inserted,
      total: articles.length,
      skipped
    };

    console.log("🏁 Collection completed:", result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("💥 Edge Function error:", error);
    
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        inserted: 0,
        total: 0,
        skipped: 0,
        error: errorMsg
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});