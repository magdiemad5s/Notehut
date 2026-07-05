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

export default function SettingsPage() {
  const [hydrated, setHydrated] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [testingEmbeddings, setTestingEmbeddings] = useState(false);

  const store = useByokStore();

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
    if (!store.llmBaseURL) {
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your AI providers and embeddings endpoints. Settings are
          stored locally in your browser.
        </p>
      </div>

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
                  Custom (OpenAI-compatible)
                </SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
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
              Your API key is stored locally in your browser and never sent to
              our servers.
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
        <CardFooter>
          <Button
            variant="outline"
            onClick={testLlm}
            disabled={testingLlm || !store.llmBaseURL}
          >
            {testingLlm ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plug className="size-4" />
            )}
            Test Connection
          </Button>
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
            your local Ollama instance or a Colab/Kaggle tunnel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Embeddings Base URL */}
          <div className="space-y-2">
            <Label htmlFor="embeddings-base-url">Embeddings Base URL</Label>
            <Input
              id="embeddings-base-url"
              type="url"
              placeholder="http://localhost:11434/v1 or https://your-tunnel.trycloudflare.com/v1"
              value={store.embeddingsBaseURL}
              onChange={(e) => store.setEmbeddingsBaseURL(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Ollama&apos;s OpenAI-compatible endpoint. For Colab tunnels, paste
              the tunnel URL + /v1.
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
