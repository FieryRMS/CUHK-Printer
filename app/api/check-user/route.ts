import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const { serverUrl, username, password } = await request.json()

  if (!serverUrl || password === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const res = await fetch(`${serverUrl}/RestfulService/IsUserExisted`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username ?? "", password }),
    signal: AbortSignal.timeout(8000),
  })

  const data = await res.json()
  return NextResponse.json({
    status: data.Status,
    result: data.Result,
    userId: data.UserId,
    message: data.Message,
  })
}
