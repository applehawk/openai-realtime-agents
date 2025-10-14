import { NextResponse } from "next/server";
import { corsHeaders, corsResponse } from '@/app/lib/cors';

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function POST(request: Request) {
  try {
    const sessionConfig = JSON.stringify({
      session: {
        type: "realtime",
        model: "gpt-realtime",
        audio: {
          output: { voice: "marin" },
        },
      },
    });

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: sessionConfig,
      }
    );

    const data = await response.json();
    console.log(data.value);

    const nextResponse = NextResponse.json(data);
    return corsResponse(nextResponse, request.headers.get('origin') || undefined);

  } catch (error) {
    console.error("Error in /session:", error);
    const errorResponse = NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
    return corsResponse(errorResponse, request.headers.get('origin') || undefined);
  }
}

export async function GET(request: Request) {
  try {

    const sessionConfig = JSON.stringify({
      session: {
          type: "realtime",
          model: "gpt-realtime",
          audio: {
              output: { voice: "marin" },
          },
      },
    });

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: sessionConfig,
      }
    );

    const data = await response.json();
    console.log(data.value);

    const nextResponse = NextResponse.json(data);
    return corsResponse(nextResponse, request.headers.get('origin') || undefined);

  } catch (error) {
    console.error("Error in /session:", error);
    const errorResponse = NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
    return corsResponse(errorResponse, request.headers.get('origin') || undefined);
  }
}
