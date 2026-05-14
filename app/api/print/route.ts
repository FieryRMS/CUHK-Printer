import { NextRequest, NextResponse } from "next/server"
import { gzipSync } from "zlib"

export async function POST(request: NextRequest) {
  const formData = await request.formData()

  const serverUrl = formData.get("serverUrl") as string
  const loginName = (formData.get("loginName") as string) ?? ""
  const password = (formData.get("password") as string) ?? ""
  const file = formData.get("file") as File | null

  if (!serverUrl || !file) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const gzipped = gzipSync(fileBuffer)

  const outForm = new FormData()
  outForm.append("LoginName", loginName)
  outForm.append("Password", password)
  outForm.append("FileType", "S")
  outForm.append(
    "printFile",
    new Blob([gzipped], { type: "application/octet-stream" }),
    file.name,
  )

  const res = await fetch(`${serverUrl}/RestfulService/PrintClientFileUpload`, {
    method: "POST",
    body: outForm,
    signal: AbortSignal.timeout(30000),
  })

  const text = await res.text()
  return NextResponse.json({ result: text.trim() })
}
