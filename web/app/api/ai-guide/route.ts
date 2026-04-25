import { NextResponse } from "next/server";

type ChatMessage = { who: "you" | "ai"; text: string };

type ReqBody = {
  question?: string;
  log?: ChatMessage[];
  tips?: string;
};

async function listModels(apiKey: string, apiVersion: string) {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, { method: "GET" });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    return { ok: false as const, status: resp.status, data };
  }
  return { ok: true as const, status: resp.status, data };
}

function pickModelFromList(data: any): string | null {
  const models = Array.isArray(data?.models) ? data.models : [];
  const candidates = models
    .map((m: any) => ({
      name: typeof m?.name === "string" ? m.name : "",
      supported: Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : []
    }))
    .filter((m: any) => m.name && m.supported.includes("generateContent"));

  const prefer = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro", "gemini-pro"];
  for (const p of prefer) {
    const found = candidates.find((m: any) => m.name.endsWith(`/models/${p}`) || m.name === `models/${p}`);
    if (found) return found.name.replace(/^models\//, "");
  }

  const first = candidates[0]?.name;
  if (!first) return null;
  return String(first).replace(/^models\//, "");
}

function extractGeminiText(data: any): string | null {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((p: any) => p?.text).filter(Boolean).join("\n");
  return text || null;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const preferredVersion = process.env.GEMINI_API_VERSION || "v1beta";
    const preferredModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    const body = (await request.json().catch(() => null)) as ReqBody | null;
    const question = body?.question?.trim() || "";
    const tips = body?.tips?.trim() || "";
    const log = Array.isArray(body?.log) ? body?.log : [];

    if (!question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    const history = log
      .slice(-10)
      .map((m) => `${m.who === "you" ? "User" : "Assistant"}: ${String(m.text || "").trim()}`)
      .filter(Boolean)
      .join("\n");

    const prompt =
      "You are AI Guide for tourism in Kyrgyzstan. Be concise and practical. " +
      "If asked about safety, equipment, difficulty, give actionable advice and warnings. " +
      "If user asks about booking/payment, explain how escrow-based tour booking works in simple terms.\n" +
      (tips ? `Context: ${tips}\n` : "") +
      (history ? `Chat history:\n${history}\n` : "") +
      `User question: ${question}`;

    const versionsToTry = preferredVersion === "v1" ? ["v1", "v1beta"] : ["v1beta", "v1"];

    let lastErr: { status?: number; statusText?: string; upstreamMessage?: string; data?: any; apiVersion?: string; model?: string } | null = null;

    for (const apiVersion of versionsToTry) {
      const attemptModels: string[] = [preferredModel];

      for (const model of attemptModels) {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 512
            }
          })
        });

        const data = await resp.json().catch(() => null);
        if (resp.ok) {
          const answer = extractGeminiText(data);
          if (!answer) {
            return NextResponse.json({ error: "Empty response from Gemini" }, { status: 500 });
          }
          return NextResponse.json({ answer }, { status: 200 });
        }

        const upstreamMessage = data?.error?.message || data?.message || "Gemini request failed";
        lastErr = {
          status: resp.status,
          statusText: resp.statusText,
          upstreamMessage,
          data,
          apiVersion,
          model
        };

        const isNotFound = resp.status === 404 || String(data?.error?.status || "").toUpperCase() === "NOT_FOUND";
        if (!isNotFound) {
          console.error("[ai-guide] Gemini upstream error", lastErr);
          continue;
        }

        const modelsResp = await listModels(apiKey, apiVersion);
        if (!modelsResp.ok) {
          console.error("[ai-guide] ListModels failed", { apiVersion, status: modelsResp.status, data: modelsResp.data });
          continue;
        }

        const picked = pickModelFromList(modelsResp.data);
        if (!picked || picked === model) {
          console.error("[ai-guide] No suitable model found via ListModels", { apiVersion, picked });
          continue;
        }

        const retryUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(
          picked
        )}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const retryResp = await fetch(retryUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 512
            }
          })
        });

        const retryData = await retryResp.json().catch(() => null);
        if (!retryResp.ok) {
          const retryMsg = retryData?.error?.message || retryData?.message || "Gemini retry failed";
          lastErr = {
            status: retryResp.status,
            statusText: retryResp.statusText,
            upstreamMessage: retryMsg,
            data: retryData,
            apiVersion,
            model: picked
          };
          console.error("[ai-guide] Gemini retry failed", lastErr);
          continue;
        }

        const answer = extractGeminiText(retryData);
        if (!answer) {
          return NextResponse.json({ error: "Empty response from Gemini" }, { status: 500 });
        }
        return NextResponse.json({ answer }, { status: 200 });
      }
    }

    console.error("[ai-guide] Gemini upstream error", lastErr);
    return NextResponse.json(
      {
        error: lastErr?.upstreamMessage || "Gemini request failed",
        upstreamStatus: lastErr?.status,
        apiVersion: lastErr?.apiVersion,
        model: lastErr?.model
      },
      { status: 500 }
    );

  } catch (err) {
    console.error("[ai-guide] Route failed", err);
    const msg = err instanceof Error ? err.message : "AI Guide failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
