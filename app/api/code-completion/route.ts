import { type NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

interface CodeSuggestionRequest {
  fileContent: string;
  cursorLine: number;
  cursorColumn: number;
  suggestionType: string;
  fileName?: string;
}

interface CodeContext {
  language: string;
  framework: string;
  beforeContext: string;
  currentLine: string;
  afterContext: string;
  cursorPosition: { line: number; column: number };
  isInFunction: boolean;
  isInClass: boolean;
  isAfterComment: boolean;
  incompletePatterns: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body: CodeSuggestionRequest = await request.json();
    const { fileContent, cursorLine, cursorColumn, suggestionType, fileName } =
      body;

    if (
      !fileContent ||
      typeof cursorLine !== "number" ||
      typeof cursorColumn !== "number" ||
      !suggestionType
    ) {
      return NextResponse.json(
        { error: "Invalid input parameters" },
        { status: 400 }
      );
    }

    const context = analyzeCodeContext(
      fileContent,
      cursorLine,
      cursorColumn,
      fileName
    );

    const prompt = buildPrompt(context, suggestionType);
    const suggestion = await generateSuggestion(prompt);

    return NextResponse.json({
      suggestion,
      context,
      metadata: {
        language: context.language,
        framework: context.framework,
        position: context.cursorPosition,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Code suggestion error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}

/* ===================================================== */
/* ================= AI GENERATION ===================== */
/* ===================================================== */

async function generateSuggestion(prompt: string): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are an expert senior software engineer. Provide ONLY the exact code to insert at the cursor. No explanations. No markdown. No backticks.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
      top_p: 0.9,
    });

    let suggestion =
      completion.choices[0]?.message?.content?.trim() ||
      "// No suggestion generated";

    // Remove accidental markdown blocks
    if (suggestion.includes("```")) {
      const match = suggestion.match(/```[\w]*\n?([\s\S]*?)```/);
      suggestion = match ? match[1].trim() : suggestion;
    }

    return suggestion;
  } catch (error) {
    console.error("Groq AI error:", error);
    return "// AI suggestion unavailable";
  }
}

/* ===================================================== */
/* ================= CONTEXT ANALYSIS ================== */
/* ===================================================== */

function analyzeCodeContext(
  content: string,
  line: number,
  column: number,
  fileName?: string
): CodeContext {
  const lines = content.split("\n");
  const currentLine = lines[line] || "";

  const radius = 10;
  const startLine = Math.max(0, line - radius);
  const endLine = Math.min(lines.length, line + radius);

  const beforeContext = lines.slice(startLine, line).join("\n");
  const afterContext = lines.slice(line + 1, endLine).join("\n");

  const language = detectLanguage(content, fileName);
  const framework = detectFramework(content);

  return {
    language,
    framework,
    beforeContext,
    currentLine,
    afterContext,
    cursorPosition: { line, column },
    isInFunction: detectInFunction(lines, line),
    isInClass: detectInClass(lines, line),
    isAfterComment: detectAfterComment(currentLine, column),
    incompletePatterns: detectIncompletePatterns(currentLine, column),
  };
}

function buildPrompt(context: CodeContext, suggestionType: string): string {
  return `
Generate a ${suggestionType} suggestion.

Language: ${context.language}
Framework: ${context.framework}

Context:
${context.beforeContext}
${context.currentLine.substring(0, context.cursorPosition.column)}|CURSOR|${context.currentLine.substring(context.cursorPosition.column)}
${context.afterContext}

Analysis:
- In Function: ${context.isInFunction}
- In Class: ${context.isInClass}
- After Comment: ${context.isAfterComment}
- Incomplete Patterns: ${context.incompletePatterns.join(", ") || "None"}

Instructions:
1. Provide ONLY code to insert at the cursor.
2. Maintain indentation.
3. Follow best practices.
`;
}

/* ===================================================== */
/* ================= HELPER FUNCTIONS ================== */
/* ===================================================== */

function detectLanguage(content: string, fileName?: string): string {
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const map: Record<string, string> = {
      ts: "TypeScript",
      tsx: "TypeScript",
      js: "JavaScript",
      jsx: "JavaScript",
      py: "Python",
      java: "Java",
      go: "Go",
      rs: "Rust",
      php: "PHP",
    };
    if (ext && map[ext]) return map[ext];
  }

  if (content.includes("interface ")) return "TypeScript";
  if (content.includes("def ")) return "Python";
  if (content.includes("package main")) return "Go";

  return "JavaScript";
}

function detectFramework(content: string): string {
  if (content.includes("next/") || content.includes("getServerSideProps"))
    return "Next.js";
  if (content.includes("import React") || content.includes("useState"))
    return "React";
  if (content.includes("<template>")) return "Vue";
  if (content.includes("@Component")) return "Angular";

  return "None";
}

function detectInFunction(lines: string[], currentLine: number): boolean {
  for (let i = currentLine - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;

    if (line.match(/^\s*(function|def|const\s+\w+\s*=|let\s+\w+\s*=)/))
      return true;

    if (line.match(/^\s*}/)) break;
  }
  return false;
}

function detectInClass(lines: string[], currentLine: number): boolean {
  for (let i = currentLine - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;

    if (line.match(/^\s*(class|interface)\s+/)) return true;
  }
  return false;
}

function detectAfterComment(line: string, column: number): boolean {
  const beforeCursor = line.substring(0, column);
  return /\/\/.*$/.test(beforeCursor) || /#.*$/.test(beforeCursor);
}

function detectIncompletePatterns(line: string, column: number): string[] {
  const beforeCursor = line.substring(0, column);
  const trimmed = beforeCursor.trim();
  const patterns: string[] = [];

  if (/^(if|while|for)\s*\($/.test(trimmed)) patterns.push("conditional");
  if (/^(function|def)\s*$/.test(trimmed)) patterns.push("function");
  if (/\{\s*$/.test(beforeCursor)) patterns.push("object");
  if (/\[\s*$/.test(beforeCursor)) patterns.push("array");
  if (/=\s*$/.test(beforeCursor)) patterns.push("assignment");
  if (/\.\s*$/.test(beforeCursor)) patterns.push("method-call");

  return patterns;
}