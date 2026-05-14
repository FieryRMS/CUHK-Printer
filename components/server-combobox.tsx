"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Clock, ServerIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { getRecents, type RecentServer } from "@/lib/recents"
import type { PrintServer } from "@/lib/types"

interface ServerComboboxProps {
  servers: PrintServer[]
  value: string
  onChange: (value: string) => void
}

export function ServerCombobox({ servers, value, onChange }: ServerComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [recents, setRecents] = React.useState<RecentServer[]>([])

  // Load recents client-side only to avoid SSR mismatch
  React.useEffect(() => {
    setRecents(getRecents().sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed))
  }, [open])

  const selected = servers.find((s) => s.url === value)

  const handleSelect = (url: string) => {
    onChange(url)
    setOpen(false)
  }

  // Servers that are not already in recents (or not recently used)
  const recentUrls = new Set(recents.map((r) => r.url))
  const otherServers = servers.filter((s) => !recentUrls.has(s.url))

  // Recents that still exist in the server list (filter out stale entries)
  const serverMap = new Map(servers.map((s) => [s.url, s]))
  const validRecents = recents.filter((r) => serverMap.has(r.url))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex items-center gap-2 truncate">
            <ServerIcon className="size-4 shrink-0 text-muted-foreground" />
            {selected ? selected.label : "Select a printer…"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search printers…" />
          <CommandList>
            <CommandEmpty>No printers found.</CommandEmpty>

            {validRecents.length > 0 && (
              <>
                <CommandGroup heading="Recent">
                  {validRecents.map((r) => {
                    const server = serverMap.get(r.url)!
                    return (
                      <CommandItem
                        key={r.url}
                        value={`recent:${server.label}`}
                        onSelect={() => handleSelect(r.url)}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            value === r.url ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <Clock className="mr-2 size-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{server.label}</span>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                          ×{r.count}
                        </span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
                {otherServers.length > 0 && <CommandSeparator />}
              </>
            )}

            {otherServers.length > 0 && (
              <CommandGroup heading={validRecents.length > 0 ? "All Printers" : undefined}>
                {otherServers.map((server) => (
                  <CommandItem
                    key={server.url}
                    value={server.label}
                    onSelect={() => handleSelect(server.url)}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        value === server.url ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {server.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
