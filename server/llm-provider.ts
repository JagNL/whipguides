/**
 * server/llm-provider.ts
 *
 * Provider-agnostic LLM interface for WhipGuides AI features.
 * Supports: OpenAI, Anthropic, Groq, Ollama (local), stub (testing).
 *
 * Provider selection via LLM_PROVIDER env var (default: openai).
 * Falls back gracefully — if provider fails, returns null rather than crashing.
 *
 * Usage:
 *   const llm = getLLMProvider();
 *   const result = await llm.complete({ system: "...", user: "...", json: true });
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRequest {
  system?: string;
  messages?: LLMMessage[];   // for multi-turn; overrides system/user
  user?: string;             // shorthand for single-turn
  maxTokens?: number;
  temperature?: number;
  json?: boolean;            // request JSON output mode
  model?: string;            // override provider default model
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokens?: { input: number; output: number };
  durationMs: number;
}

export interface LLMProvider {
  name: string;
  isAvailable(): boolean;
  complete(req: LLMRequest): Promise<LLMResponse | null>;
}

// ─── OpenAI ──────────────────────────────────────────────────
class OpenAIProvider implements LLMProvider {
  name = "openai";
  private apiKey = process.env.OPENAI_API_KEY || "";
  private defaultModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

  isAvailable() { return !!this.apiKey; }

  async complete(req: LLMRequest): Promise<LLMResponse | null> {
    if (!this.apiKey) return null;
    const start = Date.now();
    const model = req.model || this.defaultModel;

    const messages: LLMMessage[] = req.messages || [];
    if (!messages.length) {
      if (req.system) messages.push({ role: "system", content: req.system });
      if (req.user)   messages.push({ role: "user",   content: req.user });
    }

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: req.maxTokens || 4096,
          temperature: req.temperature ?? 0.2,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        console.error("[llm/openai] Error:", resp.status, err);
        return null;
      }
      const data: any = await resp.json();
      const content = data.choices?.[0]?.message?.content || "";
      return {
        content,
        provider: "openai",
        model,
        tokens: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      console.error("[llm/openai] Fetch error:", err.message);
      return null;
    }
  }
}

// ─── Anthropic ───────────────────────────────────────────────
class AnthropicProvider implements LLMProvider {
  name = "anthropic";
  private apiKey = process.env.ANTHROPIC_API_KEY || "";
  private defaultModel = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";

  isAvailable() { return !!this.apiKey; }

  async complete(req: LLMRequest): Promise<LLMResponse | null> {
    if (!this.apiKey) return null;
    const start = Date.now();
    const model = req.model || this.defaultModel;

    let system = req.system || "";
    if (req.json) system += "\n\nRespond with valid JSON only. No markdown fences.";

    const messages: LLMMessage[] = req.messages
      ? req.messages.filter(m => m.role !== "system")
      : [{ role: "user", content: req.user || "" }];

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens || 4096,
          temperature: req.temperature ?? 0.2,
          system,
          messages,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        console.error("[llm/anthropic] Error:", resp.status, err);
        return null;
      }
      const data: any = await resp.json();
      const content = data.content?.[0]?.text || "";
      return {
        content,
        provider: "anthropic",
        model,
        tokens: { input: data.usage?.input_tokens, output: data.usage?.output_tokens },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      console.error("[llm/anthropic] Fetch error:", err.message);
      return null;
    }
  }
}

// ─── Groq ────────────────────────────────────────────────────
class GroqProvider implements LLMProvider {
  name = "groq";
  private apiKey = process.env.GROQ_API_KEY || "";
  private defaultModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  isAvailable() { return !!this.apiKey; }

  async complete(req: LLMRequest): Promise<LLMResponse | null> {
    if (!this.apiKey) return null;
    const start = Date.now();
    const model = req.model || this.defaultModel;

    const messages: LLMMessage[] = req.messages || [];
    if (!messages.length) {
      if (req.system) messages.push({ role: "system", content: req.system });
      if (req.user)   messages.push({ role: "user",   content: req.user });
    }

    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: req.maxTokens || 4096,
          temperature: req.temperature ?? 0.2,
          ...(req.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        console.error("[llm/groq] Error:", resp.status, err);
        return null;
      }
      const data: any = await resp.json();
      const content = data.choices?.[0]?.message?.content || "";
      return {
        content,
        provider: "groq",
        model,
        tokens: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens },
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      console.error("[llm/groq] Fetch error:", err.message);
      return null;
    }
  }
}

// ─── Ollama (local) ──────────────────────────────────────────
class OllamaProvider implements LLMProvider {
  name = "ollama";
  private baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  private defaultModel = process.env.OLLAMA_MODEL || "llama3";

  isAvailable() { return true; } // always "available" — fails at runtime if not running

  async complete(req: LLMRequest): Promise<LLMResponse | null> {
    const start = Date.now();
    const model = req.model || this.defaultModel;

    const prompt = req.user || req.messages?.map(m => `${m.role}: ${m.content}`).join("\n") || "";
    const system = req.system || "";

    try {
      const resp = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: system ? `${system}\n\n${prompt}` : prompt,
          stream: false,
          format: req.json ? "json" : undefined,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!resp.ok) {
        console.error("[llm/ollama] Error:", resp.status);
        return null;
      }
      const data: any = await resp.json();
      return {
        content: data.response || "",
        provider: "ollama",
        model,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      console.error("[llm/ollama] Error:", err.message);
      return null;
    }
  }
}

// ─── Stub (testing / no LLM configured) ──────────────────────
class StubProvider implements LLMProvider {
  name = "stub";
  isAvailable() { return true; }

  async complete(_req: LLMRequest): Promise<LLMResponse> {
    return {
      content: JSON.stringify({
        vehicle: {},
        parts_removed: [],
        parts_needed: [],
        upgrade_opportunities: [],
        safety_warnings: [],
        fluids: [],
        tools_detected: [],
        confidence_score: 0,
        _stub: true,
      }),
      provider: "stub",
      model: "stub",
      durationMs: 0,
    };
  }
}

// ─── Provider registry + factory ─────────────────────────────
const PROVIDERS: Record<string, () => LLMProvider> = {
  openai:    () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
  groq:      () => new GroqProvider(),
  ollama:    () => new OllamaProvider(),
  stub:      () => new StubProvider(),
};

let _provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (_provider) return _provider;

  const preferred = (process.env.LLM_PROVIDER || "").toLowerCase();

  // Try preferred first
  if (preferred && PROVIDERS[preferred]) {
    const p = PROVIDERS[preferred]();
    if (p.isAvailable()) {
      _provider = p;
      console.log(`[llm] Using provider: ${p.name}`);
      return _provider;
    }
  }

  // Auto-detect: try each in priority order
  const order: (keyof typeof PROVIDERS)[] = ["openai", "anthropic", "groq", "ollama"];
  for (const key of order) {
    const p = PROVIDERS[key]();
    if (p.isAvailable()) {
      _provider = p;
      console.log(`[llm] Auto-selected provider: ${p.name}`);
      return _provider;
    }
  }

  // Fall back to stub
  console.warn("[llm] No LLM provider configured — using stub. Set LLM_PROVIDER + API key.");
  _provider = new StubProvider();
  return _provider;
}

/** Force a fresh provider on next call (useful after env change). */
export function resetLLMProvider() { _provider = null; }

/** Get info about configured/available providers (for admin UI). */
export function getLLMProviderStatus() {
  return {
    active: getLLMProvider().name,
    available: {
      openai:    !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      groq:      !!process.env.GROQ_API_KEY,
      ollama:    !!process.env.OLLAMA_BASE_URL,
    },
    models: {
      openai:    process.env.OPENAI_MODEL || "gpt-4o-mini",
      anthropic: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
      groq:      process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      ollama:    process.env.OLLAMA_MODEL || "llama3",
    },
  };
}
