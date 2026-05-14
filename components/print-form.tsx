"use client"

import * as React from "react"
import {
  CheckCircle2,
  CircleDashed,
  Eye,
  EyeOff,
  Loader2,
  Printer,
  RotateCcw,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { FileDropzone, formatBytes } from "@/components/file-dropzone"
import { ServerCombobox } from "@/components/server-combobox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { recordServerUsage } from "@/lib/recents"
import type { CheckUserResult, PrintServer, QueuedFile } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PrintFormProps {
  servers: PrintServer[]
}

function fileExtIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "pdf":
      return "📄"
    case "doc":
    case "docx":
      return "📝"
    case "ppt":
    case "pptx":
      return "📊"
    case "xls":
    case "xlsx":
      return "📈"
    case "jpg":
    case "jpeg":
    case "png":
      return "🖼️"
    case "txt":
      return "📃"
    default:
      return "📎"
  }
}

function StatusBadge({ status }: { status: QueuedFile["status"] }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="secondary" className="gap-1">
          <CircleDashed className="size-3" />
          Pending
        </Badge>
      )
    case "uploading":
      return (
        <Badge variant="secondary" className="gap-1 text-blue-600 dark:text-blue-400">
          <Loader2 className="size-3 animate-spin" />
          Uploading
        </Badge>
      )
    case "success":
      return (
        <Badge
          variant="secondary"
          className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        >
          <CheckCircle2 className="size-3" />
          Queued
        </Badge>
      )
    case "failed":
      return (
        <Badge
          variant="secondary"
          className="gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        >
          <XCircle className="size-3" />
          Failed
        </Badge>
      )
  }
}

export function PrintForm({ servers }: PrintFormProps) {
  const [serverUrl, setServerUrl] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [files, setFiles] = React.useState<QueuedFile[]>([])
  const [isPrinting, setIsPrinting] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  // Dialog state: set when Result:1 (existing queued job found)
  const [confirmDialog, setConfirmDialog] = React.useState<{
    userId: number
    queue: QueuedFile[]
  } | null>(null)

  const pendingCount = files.filter((f) => f.status === "pending" || f.status === "failed").length
  const successCount = files.filter((f) => f.status === "success").length
  const hasFiles = files.length > 0

  const addFiles = (newFiles: File[]) => {
    const queued: QueuedFile[] = newFiles.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      status: "pending",
    }))
    setFiles((prev) => [...prev, ...queued])
  }

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id))

  const retryFile = (id: string) =>
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "pending", error: undefined } : f)),
    )

  const clearCompleted = () => setFiles((prev) => prev.filter((f) => f.status !== "success"))

  const executePrint = async (queue: QueuedFile[]) => {
    setIsPrinting(true)
    setProgress(0)

    // Find the server label for recording usage
    const server = servers.find((s) => s.url === serverUrl)

    let done = 0
    for (const item of queue) {
      setFiles((prev) => prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f)))

      try {
        const form = new FormData()
        form.append("serverUrl", serverUrl)
        form.append("loginName", username)
        form.append("password", password)
        form.append("file", item.file, item.file.name)

        const res = await fetch("/api/print", { method: "POST", body: form })
        const data: { result: string; error?: string } = await res.json()

        if (data.result === "Success") {
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: "success" } : f)),
          )
          toast.success(`"${item.file.name}" sent to printer`)
          if (server) recordServerUsage(serverUrl, server.label)
        } else {
          const errMsg = data.error ?? "Server returned Fail"
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, status: "failed", error: errMsg } : f)),
          )
          toast.error(`"${item.file.name}" failed: ${errMsg}`)
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : "Network error"
        setFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "failed", error: errMsg } : f)),
        )
        toast.error(`"${item.file.name}" failed: ${errMsg}`)
      }

      done++
      setProgress(Math.round((done / queue.length) * 100))
    }

    setIsPrinting(false)
  }

  const printAll = async () => {
    if (!serverUrl) { toast.error("Select a printer server"); return }
    if (!password) { toast.error("Enter your password"); return }

    const queue = files.filter((f) => f.status === "pending" || f.status === "failed")
    if (queue.length === 0) { toast.info("No files to print"); return }

    // Pre-submit credential check
    setIsPrinting(true)
    let checkData: CheckUserResult
    try {
      const res = await fetch("/api/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl, username, password }),
      })
      checkData = await res.json()
    } catch {
      toast.error("Could not reach the print server — is VPN connected?")
      setIsPrinting(false)
      return
    }

    if (checkData.status === 2) {
      toast.error("Print server error — could not verify credentials")
      setIsPrinting(false)
      return
    }

    setIsPrinting(false)

    if (checkData.result === 1) {
      // Existing queued job found — ask user to confirm
      setConfirmDialog({ userId: checkData.userId, queue })
      return
    }

    // result === 2 (no existing job / unknown user) → proceed directly
    await executePrint(queue)
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-start bg-background px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Printer className="size-6" />
            CUHK Print Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Send files to any campus printer. Requires campus WiFi or VPN.
          </p>
        </div>

        {/* Step 1 — Server */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1 · Select Printer</CardTitle>
            <CardDescription>Choose the printer you&apos;ll walk up to.</CardDescription>
          </CardHeader>
          <CardContent>
            <ServerCombobox servers={servers} value={serverUrl} onChange={setServerUrl} />
            {serverUrl && (
              <p className="mt-2 text-xs text-muted-foreground">
                Endpoint:{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">{serverUrl}</code>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Step 2 — Credentials */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2 · Credentials</CardTitle>
            <CardDescription>
              The username and password you use to log in to the SmartPay print system. Can be any
              string — not validated on upload, only checked when you release the job at the
              printer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="e.g. john"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 24))}
                maxLength={24}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3 — Files */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">3 · Files</CardTitle>
                <CardDescription className="mt-0.5">
                  Add one or more files. Each is sent as a separate print job.
                </CardDescription>
              </div>
              {successCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCompleted}
                  className="shrink-0 gap-1 text-muted-foreground"
                >
                  Clear done
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FileDropzone onFilesAdded={addFiles} disabled={isPrinting} />

            {hasFiles && (
              <>
                <Separator />
                <ScrollArea className={cn("pr-2", files.length > 4 && "h-56")}>
                  <ul className="space-y-2">
                    {files.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 text-sm"
                      >
                        <span className="text-base leading-none" aria-hidden>
                          {fileExtIcon(item.file.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(item.file.size)}
                            {item.error && (
                              <span className="ml-2 text-destructive">{item.error}</span>
                            )}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                        <div className="flex shrink-0 gap-1">
                          {item.status === "failed" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground"
                                  onClick={() => retryFile(item.id)}
                                >
                                  <RotateCcw className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Retry</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground"
                                onClick={() => removeFile(item.id)}
                                disabled={item.status === "uploading"}
                              >
                                <XCircle className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove</TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>

        {/* Network warning */}
        {serverUrl && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/10 dark:text-amber-300">
            <AlertDescription className="text-xs">
              Print servers are only reachable on campus WiFi or via CUHK VPN.
            </AlertDescription>
          </Alert>
        )}

        {/* Print button + progress */}
        <div className="space-y-3">
          {isPrinting && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Sending files…</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={printAll}
            disabled={isPrinting || !hasFiles || pendingCount === 0}
          >
            {isPrinting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            {isPrinting
              ? "Printing…"
              : pendingCount > 0
                ? `Print ${pendingCount} file${pendingCount !== 1 ? "s" : ""}`
                : successCount > 0
                  ? "All files sent"
                  : "Add files to print"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          After submitting, log in at the physical printer with the same credentials to release your
          job.
        </p>
      </div>

      {/* Existing queued job confirmation dialog */}
      <Dialog
        open={confirmDialog !== null}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Existing print job found</DialogTitle>
            <DialogDescription>
              Account{confirmDialog?.userId ? ` #${confirmDialog.userId}` : ""} already has a job
              queued at this printer. Sending again will add to the queue. Do you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const queue = confirmDialog!.queue
                setConfirmDialog(null)
                await executePrint(queue)
              }}
            >
              Proceed anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
