import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Replace this with your actual Deepgram API key
    const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    return NextResponse.json({ key: apiKey });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
