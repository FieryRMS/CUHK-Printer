import { PrintForm } from "@/components/print-form"
import type { PrintServer } from "@/lib/types"

async function getServers(): Promise<PrintServer[]> {
  try {
    const res = await fetch("https://www.lib.cuhk.edu.hk/printer/WIFI.json", {
      next: { revalidate: 300 },
    })
    const data: { servers: string[]; message: string } = await res.json()
    return data.servers.map((entry) => {
      const idx = entry.indexOf("|")
      return {
        label: entry.slice(0, idx),
        url: entry.slice(idx + 1),
      }
    })
  } catch {
    return []
  }
}

export default async function Page() {
  const servers = await getServers()
  return <PrintForm servers={servers} />
}
