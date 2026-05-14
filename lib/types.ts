export interface PrintServer {
  label: string
  url: string
}

export interface CheckUserResult {
  status: 1 | 2
  result: 0 | 1 | 2 | 3
  userId: number
  message: string
}

export type FileStatus = "pending" | "uploading" | "success" | "failed"

export interface QueuedFile {
  id: string
  file: File
  status: FileStatus
  error?: string
}
