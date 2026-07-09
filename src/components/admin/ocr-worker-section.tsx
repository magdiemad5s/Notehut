"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, Server, Plug, Cpu } from "lucide-react"

function SwitchToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id}>{label}</Label>
      <Button
        id={id}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange(!checked)}
        data-state={checked ? "on" : "off"}
        aria-pressed={checked}
        className="min-w-[70px]"
      >
        {checked ? (
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
            <span className="size-2 rounded-full bg-current" />
            On
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-current" />
            Off
          </span>
        )}
      </Button>
    </div>
  )
}

function isMaskedKey(value: string): boolean {
  return value.includes("•")
}

export function OcrWorkerSection() {
  /* ── Settings state ── */
  const [workerUrl, setWorkerUrl] = useState("")
  const [workerApiKey, setWorkerApiKey] = useState("")
  const [hasExistingWorkerKey, setHasExistingWorkerKey] = useState(false)
  const [isChangingWorkerKey, setIsChangingWorkerKey] = useState(false)
  const [showWorkerKey, setShowWorkerKey] = useState(false)
  const [acceleratedOcrOnline, setAcceleratedOcrOnline] = useState(false)
  const [workerOnline, setWorkerOnline] = useState(false)

  /* ── UI state ── */
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  /* ── Load initial data ── */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings")
        if (!res.ok) {
          toast.error("Failed to load worker settings")
          return
        }

        const data = await res.json()
        const settings = data.settings ?? []

        for (const s of settings) {
          switch (s.key) {
            case "ocr_worker_url":
              setWorkerUrl(typeof s.value === "string" ? s.value : "")
              break
            case "ocr_worker_api_key":
              if (typeof s.value === "string") {
                if (isMaskedKey(s.value)) {
                  setWorkerApiKey(s.value)
                  setHasExistingWorkerKey(true)
                  setIsChangingWorkerKey(false)
                } else {
                  setWorkerApiKey(s.value)
                }
              }
              break
            case "accelerated_ocr_online":
              setAcceleratedOcrOnline(s.value === true || s.value === "true")
              break
            case "worker_online":
              setWorkerOnline(s.value === true || s.value === "true")
              break
          }
        }
      } catch (err) {
        toast.error(
          "Failed to load worker config: " +
            (err instanceof Error ? err.message : "Unknown error"),
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  /* ── Save all worker settings ── */
  const saveAll = async () => {
    setSaving(true)
    try {
      const settings: { key: string; value: string | boolean }[] = [
        { key: "ocr_worker_url", value: workerUrl },
        { key: "ocr_worker_api_key", value: workerApiKey },
        { key: "accelerated_ocr_online", value: acceleratedOcrOnline },
        { key: "worker_online", value: workerOnline },
      ]

      for (const setting of settings) {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setting),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Save failed" }))
          toast.error(`Failed to save ${setting.key}: ${err.error}`)
          return
        }
      }

      toast.success("Worker settings saved")
      setIsChangingWorkerKey(false)
    } catch (err) {
      toast.error(
        "Error saving worker settings: " +
          (err instanceof Error ? err.message : "Unknown error"),
      )
    } finally {
      setSaving(false)
    }
  }

  /* ── Test worker connection ── */
  const testWorker = async () => {
    if (!workerUrl) {
      toast.error("Worker URL is required to test")
      return
    }

    setTesting(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const res = await fetch(
        `${workerUrl.replace(/\/+$/, "")}/health`,
        {
          method: "GET",
          signal: controller.signal,
          headers: workerApiKey
            ? { Authorization: `Bearer ${workerApiKey}` }
            : undefined,
        },
      )

      clearTimeout(timeout)

      if (res.ok) {
        toast.success("Worker responded successfully")
      } else {
        toast.error(`Worker returned status ${res.status}`)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("Worker request timed out after 5 seconds")
      } else {
        toast.error(
          "Failed to reach worker: " +
            (err instanceof Error ? err.message : "Unknown error"),
        )
      }
    } finally {
      setTesting(false)
    }
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ─────── Worker Configuration Card ─────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            OCR Worker Configuration
          </CardTitle>
          <CardDescription>
            Configure the remote OCR worker endpoint and toggle worker features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Worker URL */}
          <div className="space-y-2">
            <Label htmlFor="ocr-worker-url">Worker URL</Label>
            <Input
              id="ocr-worker-url"
              type="url"
              placeholder="https://my-ocr-worker.example.com"
              value={workerUrl}
              onChange={(e) => setWorkerUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The base URL of your OCR worker service.
            </p>
          </div>

          {/* Worker API Key */}
          <div className="space-y-2">
            <Label htmlFor="ocr-worker-api-key">
              Worker API Key{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            {hasExistingWorkerKey && !isChangingWorkerKey ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="ocr-worker-api-key"
                    type="password"
                    value={workerApiKey}
                    readOnly
                    className="pr-10 opacity-70"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => setShowWorkerKey(!showWorkerKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showWorkerKey ? "Hide API key" : "Show API key"
                    }
                    tabIndex={-1}
                  >
                    {showWorkerKey ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsChangingWorkerKey(true)
                    setWorkerApiKey("")
                  }}
                >
                  Change Key
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="ocr-worker-api-key"
                  type={showWorkerKey ? "text" : "password"}
                  placeholder={
                    hasExistingWorkerKey
                      ? "Type new API key to replace existing..."
                      : "Optional worker auth key"
                  }
                  value={workerApiKey}
                  onChange={(e) => setWorkerApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowWorkerKey(!showWorkerKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showWorkerKey ? "Hide API key" : "Show API key"}
                >
                  {showWorkerKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Toggle: Accelerated OCR Online */}
          <SwitchToggle
            id="accelerated-ocr-online"
            label="Accelerated OCR Online"
            checked={acceleratedOcrOnline}
            onChange={setAcceleratedOcrOnline}
          />

          {/* Toggle: Worker Online */}
          <SwitchToggle
            id="worker-online"
            label="Worker Online"
            checked={workerOnline}
            onChange={setWorkerOnline}
          />
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button onClick={saveAll} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? (
              <>
                <Cpu className="size-4" />
                Saving...
              </>
            ) : (
              <>
                <Cpu className="size-4" />
                Save All
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={testWorker}
            disabled={testing || !workerUrl}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            {testing ? "Testing..." : "Test Worker"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
