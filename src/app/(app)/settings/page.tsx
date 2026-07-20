"use client";

import { useEffect, useState } from "react";
import { useByokStore, byokToHeaders, LlmProvider } from "@/lib/store/byok-store";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Info,
  Loader2,
  Plug,
  RotateCcw,
  Sparkles,
  Server,
} from "lucide-react";

const PROVIDER_PRESETS: Record<LlmProvider, string> = {
  custom: "",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  deepseek: "https://api.deepseek.com",
};

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  custom: "Custom Provider",
  gemini: "Google Gemini",
  deepseek: "DeepSeek",
};

export default function SettingsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showEmbeddingsApiKey, setShowEmbeddingsApiKey] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testingEmbeddings, setTestingEmbeddings] = useState(false);

  const store = useByokStore();

  const isByokConfigured = !!store.llmApiKey && !!store.llmModelName;

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const handleProviderChange = (value: string | null) => {
    if (!value) return
    const provider = value as LlmProvider;
    store.setLlmProvider(provider);
    const preset = PROVIDER_PRESETS[provider];
    if (
      preset &&
      (!store.llmBaseURL ||
        Object.values(PROVIDER_PRESETS).includes(store.llmBaseURL))
    ) {
      store.setLlmBaseURL(preset);
    }
  };

  const testLlm = async () => {
    if (store.llmProvider !== "gemini" && !store.llmBaseURL) {
      toast.error("LLM Base URL is required");
      return;
    }
    setTestingLlm(true);
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...byokToHeaders(store),
        },
        body: JSON.stringify({
          type: "llm",
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(
        "Request failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setTestingLlm(false);
    }
  };

  const testEmbeddings = async () => {
    if (!store.embeddingsBaseURL) {
      toast.error("Embeddings Base URL is required");
      return;
    }
    setTestingEmbeddings(true);
    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...byokToHeaders(store),
        },
        body: JSON.stringify({
          type: "embeddings",
          model: store.embeddingsModel,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(
        "Request failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setTestingEmbeddings(false);
    }
  };

  const handleReset = () => {
    store.reset();
    toast.info("Settings reset to defaults");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your AI providers and embeddings endpoints. Settings are
          stored locally in your browser.
        </p>
      </div>

      {/* Info banner — BYOK is optional */}
      <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
        <Info className="mt-0.5 size-5 shrink-0" />
        <p className="text-sm">
          NoteHut works out of the box with built-in AI. You only need to
          configure the settings below if you prefer to bring your own API keys
          (BYOK) for more control or lower costs.
        </p>
      </div>

      {/* Status badge — built-in vs BYOK */}
      {isByokConfigured ? (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
          <Sparkles className="size-4" />
          Using your own {PROVIDER_LABELS[store.llmProvider]} key
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <span className="text-lg leading-none">✓</span>
          Using built-in AI (no configuration needed)
        </div>
      )}

      {/* LLM Provider Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            LLM Provider
          </CardTitle>
          <CardDescription>
            Configure the language model provider for exam generation, chat, and
            grading.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Provider dropdown */}
          <div className="space-y-2">
            <Label htmlFor="llm-provider">Provider</Label>
            <Select
              value={store.llmProvider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger id="llm-provider" className="w-full">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">
                  Custom Provider (bring your own key)
                </SelectItem>
                <SelectItem value="gemini">
                  Google Gemini (bring your own key)
                </SelectItem>
                <SelectItem value="deepseek">
                  DeepSeek (bring your own key)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave empty to use NoteHut&apos;s built-in AI. Only select a
              provider if you want to use your own API key.
            </p>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="llm-base-url">Base URL</Label>
            <Input
              id="llm-base-url"
              type="url"
              placeholder="https://api.example.com/v1"
              value={store.llmBaseURL}
              onChange={(e) => store.setLlmBaseURL(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The API base URL (without trailing slash). Auto-filled based on
              provider selection.
            </p>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="llm-api-key">API Key</Label>
            <div className="relative">
              <Input
                id="llm-api-key"
                type={showApiKey ? "text" : "password"}
                placeholder="sk-..."
                value={store.llmApiKey}
                onChange={(e) => store.setLlmApiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showApiKey ? "Hide API key" : "Show API key"}
              >
                {showApiKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
               Your API key is stored locally in your browser and sent only in
               transient requests to NoteHut&apos;s AI routes; it is not persisted
               by the server.
            </p>
          </div>

          {/* Model Name */}
          <div className="space-y-2">
            <Label htmlFor="llm-model">Model Name</Label>
            <Input
              id="llm-model"
              type="text"
              placeholder="e.g. gemini-2.0-flash, deepseek-chat, gpt-4o"
              value={store.llmModelName}
              onChange={(e) => store.setLlmModelName(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={testLlm}
            disabled={
              testingLlm ||
              !store.llmApiKey ||
              !store.llmModelName ||
              (store.llmProvider !== "gemini" && !store.llmBaseURL)
            }
          >
            {testingLlm ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            Test Connection
          </Button>
          {isByokConfigured && (
            <Button
              variant="ghost"
              onClick={() => {
                store.setLlmBaseURL("");
                store.setLlmApiKey("");
                store.setLlmModelName("");
                toast.info("Cleared BYOK settings. Using built-in AI.");
              }}
            >
              <RotateCcw className="size-4" />
              Clear and use built-in AI
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Embeddings Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-5" />
            Embeddings (Ollama / Qwen3)
          </CardTitle>
          <CardDescription>
            Configure the embeddings endpoint for document vectorization. Use
            your local Ollama instance or an authenticated NoteHut gateway.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Embeddings Base URL */}
          <div className="space-y-2">
            <Label htmlFor="embeddings-base-url">Embeddings Base URL</Label>
            <Input
              id="embeddings-base-url"
              type="url"
              placeholder="http://localhost:11434/v1 or https://your-gateway.example.com/ollama/v1"
              value={store.embeddingsBaseURL}
              onChange={(e) => store.setEmbeddingsBaseURL(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ollama&apos;s OpenAI-compatible endpoint. For a NoteHut notebook
              gateway, use the generated URL ending in /ollama/v1.
            </p>
          </div>

          {/* Embeddings Model */}
          <div className="space-y-2">
            <Label htmlFor="embeddings-api-key">Embeddings API Key</Label>
            <div className="relative">
              <Input
                id="embeddings-api-key"
                type={showEmbeddingsApiKey ? "text" : "password"}
                placeholder="Required for an authenticated remote gateway"
                value={store.embeddingsApiKey}
                onChange={(e) => store.setEmbeddingsApiKey(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowEmbeddingsApiKey(!showEmbeddingsApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showEmbeddingsApiKey ? "Hide embeddings API key" : "Show embeddings API key"}
              >
                {showEmbeddingsApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use the worker key printed by the deployment notebook. Leave blank only for a trusted local unauthenticated endpoint.
            </p>
          </div>

          {/* Embeddings Model */}
          <div className="space-y-2">
            <Label htmlFor="embeddings-model">Embeddings Model</Label>
            <Input
              id="embeddings-model"
              type="text"
              placeholder="qwen3-embedding:0.6b"
              value={store.embeddingsModel}
              onChange={(e) => store.setEmbeddingsModel(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Default: qwen3-embedding:0.6b (1024 dimensions). Must match the
              model loaded in Ollama.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            onClick={testEmbeddings}
            disabled={testingEmbeddings || !store.embeddingsBaseURL}
          >
            {testingEmbeddings ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            Test Connection
          </Button>
        </CardFooter>
      </Card>

      <Separator />

      {/* Reset */}
      <div className="flex justify-end">
        <Button variant="ghost" onClick={handleReset}>
          <RotateCcw className="size-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
