import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

/* ============================
   SAFE ENV CHECK
============================ */

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  throw new Error("Missing GROQ_API_KEY in environment variables");
}

const groq = new Groq({ apiKey });

/* ============================
   TYPES
============================ */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  model?: string;
}

/* ============================
   ALLOWED MODELS
============================ */

const ALLOWED_MODELS = [
  "llama3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "mixtral-8x7b-32768",
] as const;

type AllowedModel = (typeof ALLOWED_MODELS)[number];

/* ============================
   SYSTEM PROMPT
============================ */

const SYSTEM_PROMPT = `
You are a professional AI coding assistant.

You help developers with:
- Debugging
- Code explanations
- Best practices
- Clean architecture
- Optimizations
- Reviewing code

Always respond clearly and use proper code formatting.
`;

/* ============================
   API HANDLER
============================ */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;

    const { message, history = [], model } = body;

    /* ============================
       VALIDATE MESSAGE
    ============================ */

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    /* ============================
       VALIDATE HISTORY
    ============================ */

    const validHistory: ChatMessage[] = Array.isArray(history)
      ? history.filter(
          (msg): msg is ChatMessage =>
            Boolean(
              msg &&
                typeof msg === "object" &&
                (msg as ChatMessage).role &&
                ((msg as ChatMessage).role === "user" ||
                  (msg as ChatMessage).role === "assistant") &&
                typeof (msg as ChatMessage).content === "string"
            )
        )
      : [];

    const recentHistory = validHistory.slice(-10);

    /* ============================
       VALIDATE MODEL
    ============================ */

    const selectedModel: AllowedModel =
      model && ALLOWED_MODELS.includes(model as AllowedModel)
        ? (model as AllowedModel)
        : "llama3.1-8b-instant";

    /* ============================
       CALL GROQ
    ============================ */

    const completion = await groq.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...recentHistory,
        { role: "user", content: message },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9,
    });

    const aiResponse =
      completion.choices?.[0]?.message?.content?.trim() ??
      "No response generated.";

    return NextResponse.json({
      response: aiResponse,
      model: selectedModel,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Groq Full Error:", error);

    let errorMessage = "Unknown error";

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}