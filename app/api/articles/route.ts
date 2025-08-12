// 나는솔로 기사 조회 API 라우트
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // 환경변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return Response.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    console.log(`📄 Fetching articles: limit=${limit}, offset=${offset}`);

    // Supabase REST API로 기사 조회 (발행일 최신순 정렬)
    const response = await fetch(
      `${supabaseUrl}/rest/v1/articles?select=*&order=published_at.desc.nullslast,created_at.desc&limit=${limit}&offset=${offset}`,
      {
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase API error: ${response.status}`);
    }

    const articles = await response.json();

    console.log(`✅ Retrieved ${articles.length} articles`);

    return Response.json({
      success: true,
      data: articles,
      pagination: {
        limit,
        offset,
        total: articles.length
      }
    });

  } catch (error) {
    console.error("💥 Articles API error:", error);
    return Response.json(
      { 
        success: false, 
        error: "Failed to fetch articles",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}