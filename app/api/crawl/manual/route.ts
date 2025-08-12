// 나는솔로 뉴스 수집 API 라우트
export const runtime = "nodejs";

interface CollectionRequest {
  sourceIds?: string[];
  maxPerSource?: number;
}

interface CollectionResponse {
  inserted: number;
  total: number;
  skipped: number;
  errors: Array<{
    source_id: string;
    message: string;
  }>;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body: CollectionRequest = await request.json().catch(() => ({}));
    
    // 환경 변수 검증
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase environment variables");
      return Response.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 요청 파라미터 정리
    const requestPayload = {
      sourceIds: Array.isArray(body.sourceIds) ? body.sourceIds : undefined,
      maxPerSource: typeof body.maxPerSource === 'number' 
        ? Math.min(Math.max(body.maxPerSource, 1), 100)
        : 20
    };

    console.log("🚀 Starting manual collection:", requestPayload);

    // Supabase Edge Function 호출
    const functionUrl = `${supabaseUrl}/functions/v1/crawl_manual`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`Edge Function error (${response.status}):`, errorText);
      
      return Response.json(
        { error: `Collection service error (${response.status})` },
        { status: response.status }
      );
    }

    const result: CollectionResponse = await response.json();
    
    console.log("✅ Collection completed:", {
      inserted: result.inserted,
      total: result.total,
      skipped: result.skipped,
      errorCount: result.errors?.length || 0
    });

    return Response.json(result, { 
      status: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST",
        "access-control-allow-headers": "content-type"
      }
    });

  } catch (error) {
    console.error("💥 API Route error:", error);
    
    return Response.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function GET() {
  return Response.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}