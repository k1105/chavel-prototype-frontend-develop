import {NextRequest, NextResponse} from "next/server";

interface ChatRequest {
  book_id: string;
  character_id: number | null;
  pos: number;
  question: string;
  history: {
    character_id: number;
    message: string;
  }[];
}

const CHAT_API_URL = "http://localhost:8000/chat";

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();

    console.log("Chat API called, forwarding to:", CHAT_API_URL, body);

    // localhost:8000/chat にリクエストを転送
    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chat API error:", response.status, errorText);
      return NextResponse.json(
        {error: errorText || "External API error"},
        {status: response.status}
      );
    }

    const data = await response.json();
    console.log("Chat API response:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Chat API error:", error);

    // ネットワークエラーなどの場合
    if (error instanceof Error) {
      return NextResponse.json(
        {error: `Failed to connect to chat API: ${error.message}`},
        {status: 502}
      );
    }

    return NextResponse.json({error: "Internal server error"}, {status: 500});
  }
}
