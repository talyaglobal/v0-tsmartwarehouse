import { NextRequest, NextResponse } from "next/server";

const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "kb-warebnb_dev";
const KEYCLOAK_CLIENT_ID = "admin-cli";

let _tokenUrl: string | null = null;
async function getTokenUrl(): Promise<string> {
  if (_tokenUrl) return _tokenUrl;
  const bases = [
    process.env.KEYCLOAK_URL || process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.kolaybase.com",
    "https://auth.basefyio.com",
  ];
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`);
      if (res.ok) { const c = await res.json(); if (c.token_endpoint) { _tokenUrl = c.token_endpoint; return _tokenUrl; } }
    } catch { /* next */ }
  }
  _tokenUrl = `https://auth.basefyio.com/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
  return _tokenUrl;
}

export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json();

    if (!refresh_token) {
      return NextResponse.json(
        { error: "refresh_token is required" },
        { status: 400 }
      );
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: KEYCLOAK_CLIENT_ID,
      refresh_token: refresh_token,
    });

    const TOKEN_URL = await getTokenUrl();
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: result.error_description || "Session expired" },
        { status: response.status }
      );
    }

    return NextResponse.json({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Refresh failed" },
      { status: 500 }
    );
  }
}
