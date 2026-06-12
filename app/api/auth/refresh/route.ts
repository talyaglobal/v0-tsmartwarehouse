import { NextRequest, NextResponse } from "next/server";

const _rawUrl = (
  process.env.BASEFYIO_API_URL ||
  process.env.NEXT_PUBLIC_BASEFYIO_URL ||
  "https://api.basefyio.com"
).replace(/\/+$/, "");
const API_URL = _rawUrl.endsWith("/api") ? _rawUrl : `${_rawUrl}/api`;
const ANON_KEY =
  process.env.NEXT_PUBLIC_BASEFYIO_ANON_KEY ||
  process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY ||
  "";

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json();

    if (!refresh_token) {
      return NextResponse.json(
        { error: "refresh_token is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${API_URL}/rest/v1/auth/refresh`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: refresh_token }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: result.message || result.error_description || "Session expired" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      access_token: result.accessToken || result.access_token,
      refresh_token: result.refreshToken || result.refresh_token,
      expires_in: result.expiresIn || result.expires_in,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Refresh failed" },
      { status: 500 }
    );
  }
}
