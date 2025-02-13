import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Replace this with your actual Deepgram API key
    const apiKey = "d3ec5b8d86c1f5ff95bc89aee2aad135eb8b059f";

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
