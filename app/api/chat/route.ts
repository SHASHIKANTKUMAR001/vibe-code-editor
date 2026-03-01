import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

// ✅ Safe env check (NO "!")
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
];

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
    const body: ChatRequest = await req.json();

    const { message, history = [], model } = body;

    // ✅ Validate message
    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    // ✅ Validate history
    const validHistory: ChatMessage[] = Array.isArray(history)
      ? history.filter(
          (msg) =>
            msg &&
            typeof msg === "object" &&
            (msg.role === "user" || msg.role === "assistant") &&
            typeof msg.content === "string"
        )
      : [];

    // Keep only last 10 messages
    const recentHistory = validHistory.slice(-10);

    // ✅ Validate model safely
    const selectedModel = ALLOWED_MODELS.includes(model || "")
      ? model!
      : "llama-3.1-8b-instant";

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
      completion.choices[0]?.message?.content?.trim() ||
      "No response generated.";

    return NextResponse.json({
      response: aiResponse,
      model: selectedModel,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("Groq Full Error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: error?.message || "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}