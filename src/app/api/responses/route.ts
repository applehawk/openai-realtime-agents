import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Proxy endpoint for the OpenAI Responses API
export async function POST(req: NextRequest) {
  const body = await req.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (body.text?.format?.type === 'json_schema') {
    return await structuredResponse(openai, body);
  } else {
    return await textResponse(openai, body);
  }
}

async function structuredResponse(openai: OpenAI, body: any) {
  try {
    const response = await openai.responses.parse({
      ...(body as any),
      stream: false,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('responses proxy error', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 }); 
  }
}

async function textResponse(openai: OpenAI, body: any) {
  try {
    console.log('[responses API] Incoming request body:', JSON.stringify({
      model: body.model,
      inputLength: body.input?.length,
      toolsCount: body.tools?.length,
    }, null, 2));

    const response = await openai.responses.create({
      ...(body as any),
      stream: false,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error('[responses API] Full error details:', {
      message: err.message,
      status: err.status,
      type: err.type,
      code: err.code,
      error: err.error,
    });
    return NextResponse.json({
      error: 'failed',
      details: err.message || 'Unknown error',
      status: err.status,
    }, { status: err.status || 500 });
  }
}
  