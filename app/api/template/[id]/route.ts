import {
  readTemplateStructureFromJson,
  saveTemplateStructureToJson,
} from "@/modules/playground/lib/path-to-json";
import { db } from "@/lib/db";
import { templatePaths } from "@/lib/template";
import path from "path";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";

/* ============================= */
/* ===== JSON VALIDATION ======= */
/* ============================= */

function validateJsonStructure(data: unknown): boolean {
  try {
    JSON.parse(JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Invalid JSON structure:", error);
    return false;
  }
}

/* ============================= */
/* ======== API ROUTE ========== */
/* ============================= */

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id } = context.params;

    /* ---------- Validate ID ---------- */

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing playground ID" },
        { status: 400 }
      );
    }

    /* ---------- Fetch Playground ---------- */

    const playground = await db.playground.findUnique({
      where: { id },
    });

    if (!playground) {
      return NextResponse.json(
        { error: "Playground not found" },
        { status: 404 }
      );
    }

    /* ---------- Resolve Template ---------- */

    const templateKey =
      playground.template as keyof typeof templatePaths;

    const templatePath = templatePaths[templateKey];

    if (!templatePath) {
      return NextResponse.json(
        { error: "Invalid template" },
        { status: 404 }
      );
    }

    /* ---------- Build Paths ---------- */

    const inputPath = path.join(process.cwd(), templatePath);

    const outputDir = path.join(process.cwd(), "output");
    const outputFile = path.join(
      outputDir,
      `${templateKey}-${id}.json`
    );

    /* ---------- Ensure Output Directory Exists ---------- */

    await fs.mkdir(outputDir, { recursive: true });

    /* ---------- Generate JSON ---------- */

    await saveTemplateStructureToJson(inputPath, outputFile);

    const result = await readTemplateStructureFromJson(outputFile);

    /* ---------- Validate JSON ---------- */

    if (!result || !validateJsonStructure(result.items)) {
      return NextResponse.json(
        { error: "Invalid JSON structure" },
        { status: 500 }
      );
    }

    /* ---------- Cleanup (Safe Delete) ---------- */

    try {
      await fs.unlink(outputFile);
    } catch (cleanupError) {
      console.warn("Temporary file cleanup failed:", cleanupError);
    }

    /* ---------- Success Response ---------- */

    return NextResponse.json(
      {
        success: true,
        templateJson: result,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error generating template JSON:", error);

    let errorMessage = "Unknown error";

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: "Failed to generate template",
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}