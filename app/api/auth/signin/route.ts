import { NextRequest, NextResponse } from "next/server";

const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "kb-warebnb_dev";
const KEYCLOAK_CLIENT_ID = "admin-cli";

// Discover the real token endpoint from Keycloak's well-known config
// auth.kolaybase.com redirects to auth.basefyio.com — use discovery to be resilient
let _tokenUrl: string | null = null;
async function getTokenUrl(): Promise<string> {
  if (_tokenUrl) return _tokenUrl;
  const discoveryUrls = [
    process.env.KEYCLOAK_URL || process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.kolaybase.com",
    "https://auth.basefyio.com",
  ];
  for (const base of discoveryUrls) {
    try {
      const res = await fetch(`${base}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration`);
      if (res.ok) {
        const config = await res.json();
        if (config.token_endpoint) {
          _tokenUrl = config.token_endpoint;
          console.log("[signin] Discovered token endpoint:", _tokenUrl);
          return _tokenUrl;
        }
      }
    } catch { /* try next */ }
  }
  // Fallback
  _tokenUrl = `https://auth.basefyio.com/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
  return _tokenUrl;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const body = new URLSearchParams({
      grant_type: "password",
      client_id: KEYCLOAK_CLIENT_ID,
      username: email,
      password: password,
      scope: "openid",
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
        {
          error: result.error_description || result.error || "Invalid credentials",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
      token_type: result.token_type,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Authentication failed" },
      { status: 500 }
    );
  }
}
