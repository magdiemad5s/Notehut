"use client"

import { useEffect, useState } from "react"
import { byokToHeaders, type LlmProvider } from "@/lib/store/byok-store"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, Sparkles, Server, Brain } from "lucide-react"

type FallbackLlmValue = {
  llmProvider: LlmProvider
  llmBaseURL: string
  llmApiKey: string
  llmModelName: string
}

type FallbackEmbeddingsValue = {
  embeddingsBaseURL: string
  embeddingsApiKey: string
  embeddingsModel: string
}

const PROVIDER_PRESETS: Record<LlmProvider, string> = {
  custom: "",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com",
}

function isMaskedKey(value: string): boolean {
  return value.includes("•")
}

export function AiConfigSection() {
  /* ── LLM state ── */
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("custom")
  const [llmBaseURL, setLlmBaseURL] = useState("")
  const [llmApiKey, setLlmApiKey] = useState("")
  const [llmModelName, setLlmModelName] = useState("")
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [hasExistingLlmKey, setHasExistingLlmKey] = useState(false)
  const [isChangingLlmKey, setIsChangingLlmKey] = useState(false)

  /* ── Embeddings state ── */
  const [embeddingsBaseURL, setEmbeddingsBaseURL] = useState("")
  const [embeddingsApiKey, setEmbeddingsApiKey] = useState("")
  const [showEmbeddingsKey, setShowEmbeddingsKey] = useState(false)
  const [hasExistingEmbeddingsKey, setHasExistingEmbeddingsKey] = useState(false)
  const [isChangingEmbeddingsKey, setIsChangingEmbeddingsKey] = useState(false)
  const [embeddingsModel, setEmbeddingsModel] = useState("qwen3-embedding:0.6b")

  /* ── Per-feature model overrides ── */
  const [examModel, setExamModel] = useState("")
  const [chatModel, setChatModel] = useState("")
  const [gradingModel, setGradingModel] = useState("")
  const [tutorModel, setTutorModel] = useState("")

  /* ── Loading / saving state ── */
  const [loading, setLoading] = useState(true)
  const [savingLlm, setSavingLlm] = useState(false)
  const [savingEmbeddings, setSavingEmbeddings] = useState(false)
  const [savingOverrides, setSavingOverrides] = useState(false)
  const [testingLlm, setTestingLlm] = useState(false)
  const [testingEmbeddings, setTestingEmbeddings] = useState(false)

  /* ── Fetch initial data ── */
  useEffect(() => {
    async function load() {
      try {
        const [keysRes, settingsRes] = await Promise.all([
          fetch("/api/admin/fallback-keys"),
          fetch("/api/admin/settings"),
        ])

        if (keysRes.ok) {
          const keysData = await keysRes.json()
          const secrets = keysData.secrets ?? []

          const llmSecret = secrets.find(
            (s: { key: string }) => s.key === "fallback_llm",
          )
          if (llmSecret?.value) {
            const v = llmSecret.value as FallbackLlmValue
            setLlmProvider(v.llmProvider ?? "custom")
            setLlmBaseURL(v.llmBaseURL ?? "")
            if (v.llmApiKey && isMaskedKey(v.llmApiKey)) {
              setLlmApiKey(v.llmApiKey)
              setHasExistingLlmKey(true)
              setIsChangingLlmKey(false)
            } else {
              setLlmApiKey(v.llmApiKey ?? "")
            }
            setLlmModelName(v.llmModelName ?? "")
          }

          const embSecret = secrets.find(
            (s: { key: string }) => s.key === "fallback_embeddings",
          )
          if (embSecret?.value) {
            const v = embSecret.value as FallbackEmbeddingsValue
            setEmbeddingsBaseURL(v.embeddingsBaseURL ?? "")
            if (v.embeddingsApiKey && isMaskedKey(v.embeddingsApiKey)) {
              setEmbeddingsApiKey(v.embeddingsApiKey)
              setHasExistingEmbeddingsKey(true)
            } else {
              setEmbeddingsApiKey(v.embeddingsApiKey ?? "")
            }
            setEmbeddingsModel(v.embeddingsModel ?? "qwen3-embedding:0.6b")
          }
        }

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          const settings = settingsData.settings ?? []
          for (const s of settings) {
            switch (s.key) {
              case "exam_model":
                setExamModel(typeof s.value === "string" ? s.value : "")
                break
              case "chat_model":
                setChatModel(typeof s.value === "string" ? s.value : "")
                break
              case "grading_model":
                setGradingModel(typeof s.value === "string" ? s.value : "")
                break
              case "tutor_model":
                setTutorModel(typeof s.value === "string" ? s.value : "")
                break
            }
          }
        }
      } catch (err) {
        toast.error(
          "Failed to load AI configuration: " +
            (err instanceof Error ? err.message : "Unknown error"),
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  /* ── Provider change handler ── */
  const handleProviderChange = (value: string | null) => {
    if (!value) return
    const provider = value as LlmProvider
    setLlmProvider(provider)
    const preset = PROVIDER_PRESETS[provider]
    if (
      preset &&
      (!llmBaseURL || Object.values(PROVIDER_PRESETS).includes(llmBaseURL))
    ) {
      setLlmBaseURL(preset)
    }
  }

  /* ── Save LLM config ── */
  const saveLlmConfig = async () => {
    setSavingLlm(true)
    try {
      const value: Record<string, unknown> = {
        llmProvider,
        llmBaseURL,
        llmModelName,
      }
      if (!isMaskedKey(llmApiKey)) value.llmApiKey = llmApiKey

      const res = await fetch("/api/admin/fallback-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "fallback_llm", value }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }))
        toast.error(err.error || "Failed to save LLM config")
        return
      }

      toast.success("LLM configuration saved")
      setIsChangingLlmKey(false)
    } catch (err) {
      toast.error(
        "Error saving LLM config: " +
          (err instanceof Error ? err.message : "Unknown error"),
      )
    } finally {
      setSavingLlm(false)
    }
  }

  /* ── Save Embeddings config ── */
  const saveEmbeddingsConfig = async () => {
    setSavingEmbeddings(true)
    try {
      const value: Record<string, string> = {
        embeddingsBaseURL,
        embeddingsModel,
      }
      if (!isMaskedKey(embeddingsApiKey)) value.embeddingsApiKey = embeddingsApiKey

      const res = await fetch("/api/admin/fallback-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "fallback_embeddings", value }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }))
        toast.error(err.error || "Failed to save embeddings config")
        return
      }

      toast.success("Embeddings configuration saved")
      setIsChangingEmbeddingsKey(false)
    } catch (err) {
      toast.error(
        "Error saving embeddings config: " +
          (err instanceof Error ? err.message : "Unknown error"),
      )
    } finally {
      setSavingEmbeddings(false)
    }
  }

  /* ── Save per-feature model overrides ── */
  const saveModelOverrides = async () => {
    setSavingOverrides(true)
    const overrides = [
      { key: "exam_model", value: examModel },
      { key: "chat_model", value: chatModel },
      { key: "grading_model", value: gradingModel },
      { key: "tutor_model", value: tutorModel },
    ]

    try {
      for (const override of overrides) {
        const res = await fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(override),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Save failed" }))
          toast.error(`Failed to save ${override.key}: ${err.error}`)
          return
        }
      }

      toast.success("Model overrides saved")
    } catch (err) {
      toast.error(
        "Error saving model overrides: " +
          (err instanceof Error ? err.message : "Unknown error"),
      )
    } finally {
      setSavingOverrides(false)
    }
  }

  /* ── Test LLM connection ── */
  const testLlm = async () => {
    if (!llmBaseURL) {
      toast.error("LLM Base URL is required to test")
      return
    }

    setTestingLlm(true)
    try {
      if (hasExistingLlmKey && isMaskedKey(llmApiKey)) {
        toast.error('Enter the API key again to test this connection')
        return
      }
      // Build a byok config object from our local state for header generation
      const config = {
        llmProvider,
        llmBaseURL,
        llmApiKey: isMaskedKey(llmApiKey) || !llmApiKey ? "" : llmApiKey,
        llmModelName,
        embeddingsBaseURL,
        embeddingsApiKey,
        embeddingsModel,
      }

      if (!config.llmApiKey) {
        toast.error('Enter the API key again to test this connection')
        return
      }

      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...byokToHeaders(config),
        },
        body: JSON.stringify({ type: "llm" }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(
        "Connection test failed: " +
          (err instanceof Error ? err.message : "Unknown error"),
      )
    } finally {
      setTestingLlm(false)
    }
  }

  /* ── Test Embeddings connection ── */
  const testEmbeddings = async () => {
    if (!embeddingsBaseURL) {
      toast.error("Embeddings Base URL is required to test")
      return
    }

    setTestingEmbeddings(true)
    try {
      const config = {
        llmProvider,
        llmBaseURL,
        llmApiKey: "",
        llmModelName,
        embeddingsBaseURL,
        embeddingsApiKey: isMaskedKey(embeddingsApiKey) ? "" : embeddingsApiKey,
        embeddingsModel,
      }
      if (hasExistingEmbeddingsKey && isMaskedKey(embeddingsApiKey)) {
        toast.error('Enter the embeddings API key again to test this connection')
        return
      }

      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...byokToHeaders(config),
        },
        body: JSON.stringify({ type: "embeddings", model: embeddingsModel }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
      } else {
        toast.error(data.message)
      }
    } catch (err) {
      toast.error(
        "Connection test failed: " +
          (err instanceof Error ? err.message : "Unknown error"),
      )
    } finally {
      setTestingEmbeddings(false)
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
      {/* ─────── LLM Provider Card ─────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            Fallback LLM Provider
          </CardTitle>
          <CardDescription>
            Configure the fallback language model. Individual features can
            override this in the Model Overrides section below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="ai-llm-provider">Provider</Label>
            <Select value={llmProvider} onValueChange={handleProviderChange}>
              <SelectTrigger id="ai-llm-provider" className="w-full">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom Provider</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="ai-llm-base-url">Base URL</Label>
            <Input
              id="ai-llm-base-url"
              type="url"
              placeholder="https://api.example.com/v1"
              value={llmBaseURL}
              onChange={(e) => setLlmBaseURL(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="ai-llm-api-key">API Key</Label>
            {hasExistingLlmKey && !isChangingLlmKey ? (
              <div className="flex items-center gap-2">
                <Input
                  id="ai-llm-api-key"
                  type="password"
                  value={llmApiKey}
                  readOnly
                  className="flex-1 opacity-70"
                  tabIndex={-1}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsChangingLlmKey(true)
                    setLlmApiKey("")
                  }}
                >
                  Change Key
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="ai-llm-api-key"
                  type={showLlmKey ? "text" : "password"}
                  placeholder={
                    hasExistingLlmKey
                      ? "Type new API key to replace existing..."
                      : "sk-..."
                  }
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowLlmKey(!showLlmKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showLlmKey ? "Hide API key" : "Show API key"}
                >
                  {showLlmKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Model Name */}
          <div className="space-y-2">
            <Label htmlFor="ai-llm-model">Model Name</Label>
            <Input
              id="ai-llm-model"
              type="text"
              placeholder="e.g. gemini-2.0-flash, deepseek-chat, gpt-4o"
              value={llmModelName}
              onChange={(e) => setLlmModelName(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button onClick={saveLlmConfig} disabled={savingLlm}>
            {savingLlm && <Loader2 className="size-4 animate-spin" />}
            {savingLlm ? "Saving..." : "Save LLM Config"}
          </Button>
          <Button
            variant="outline"
            onClick={testLlm}
            disabled={testingLlm || !llmBaseURL}
          >
            {testingLlm ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {testingLlm ? "Testing..." : "Test LLM Connection"}
          </Button>
        </CardFooter>
      </Card>

      {/* ─────── Embeddings Card ─────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Fallback Embeddings
          </CardTitle>
          <CardDescription>
            Configure the fallback embeddings endpoint for document
            vectorization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Embeddings Base URL */}
          <div className="space-y-2">
            <Label htmlFor="ai-emb-base-url">Embeddings Base URL</Label>
            <Input
              id="ai-emb-base-url"
              type="url"
              placeholder="http://localhost:11434/v1"
              value={embeddingsBaseURL}
              onChange={(e) => setEmbeddingsBaseURL(e.target.value)}
            />
          </div>

          {/* Embeddings Model */}
          <div className="space-y-2">
            <Label htmlFor="ai-emb-api-key">Embeddings API Key</Label>
            {hasExistingEmbeddingsKey && !isChangingEmbeddingsKey ? (
              <div className="flex items-center gap-2">
                <Input id="ai-emb-api-key" type="password" value={embeddingsApiKey} readOnly className="opacity-70" />
                <Button type="button" variant="outline" size="sm" onClick={() => { setIsChangingEmbeddingsKey(true); setEmbeddingsApiKey("") }}>
                  Change Key
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  id="ai-emb-api-key"
                  type={showEmbeddingsKey ? "text" : "password"}
                  placeholder="Worker gateway bearer key"
                  value={embeddingsApiKey}
                  onChange={(e) => setEmbeddingsApiKey(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEmbeddingsKey(!showEmbeddingsKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showEmbeddingsKey ? "Hide embeddings API key" : "Show embeddings API key"}
                >
                  {showEmbeddingsKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Required for the authenticated notebook gateway; optional only for a trusted local endpoint.</p>
          </div>

          {/* Embeddings Model */}
          <div className="space-y-2">
            <Label htmlFor="ai-emb-model">Embeddings Model</Label>
            <Input
              id="ai-emb-model"
              type="text"
              placeholder="qwen3-embedding:0.6b"
              value={embeddingsModel}
              onChange={(e) => setEmbeddingsModel(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button onClick={saveEmbeddingsConfig} disabled={savingEmbeddings}>
            {savingEmbeddings && <Loader2 className="size-4 animate-spin" />}
            {savingEmbeddings ? "Saving..." : "Save Embeddings Config"}
          </Button>
          <Button
            variant="outline"
            onClick={testEmbeddings}
            disabled={testingEmbeddings || !embeddingsBaseURL}
          >
            {testingEmbeddings ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Server className="size-4" />
            )}
            {testingEmbeddings ? "Testing..." : "Test Embeddings Connection"}
          </Button>
        </CardFooter>
      </Card>

      <Separator />

      {/* ─────── Per-Feature Model Overrides Card ─────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-5" />
            Per-Feature Model Overrides
          </CardTitle>
          <CardDescription>
            Optionally override the fallback model for specific features. Leave
            empty to use the fallback LLM model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-exam-model">Exam Model</Label>
              <Input
                id="ai-exam-model"
                type="text"
                placeholder="e.g. gemini-2.5-flash"
                value={examModel}
                onChange={(e) => setExamModel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Model used for exam generation. Empty = use fallback.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-chat-model">Chat Model</Label>
              <Input
                id="ai-chat-model"
                type="text"
                placeholder="e.g. deepseek-chat"
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Model used for chat conversations. Empty = use fallback.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-grading-model">Grading Model</Label>
              <Input
                id="ai-grading-model"
                type="text"
                placeholder="e.g. gpt-4o"
                value={gradingModel}
                onChange={(e) => setGradingModel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Model used for grading. Empty = use fallback.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-tutor-model">Tutor Model</Label>
              <Input
                id="ai-tutor-model"
                type="text"
                placeholder="e.g. gemini-2.0-flash"
                value={tutorModel}
                onChange={(e) => setTutorModel(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Model used for tutoring. Empty = use fallback.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveModelOverrides} disabled={savingOverrides}>
            {savingOverrides && <Loader2 className="size-4 animate-spin" />}
            {savingOverrides ? "Saving..." : "Save Model Overrides"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
