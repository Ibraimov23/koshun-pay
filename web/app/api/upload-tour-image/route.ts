import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function sanitizeBaseName(name: string) {
  const base = name.replace(/\.[^/.]+$/, "");
  return base.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "tour";
}

function extFor(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };
  if (byType[file.type]) return byType[file.type];
  const fromName = path.extname(file.name || "").toLowerCase();
  return fromName || ".jpg";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: "Image must be between 1B and 5MB" }, { status: 400 });
    }

    const now = Date.now();
    const fileName = `${sanitizeBaseName(file.name)}-${now}${extFor(file)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    if (process.env.VERCEL) {
      const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN;
      if (!token) {
        return NextResponse.json(
          { error: "BLOB_READ_WRITE_TOKEN is not configured" },
          { status: 500 }
        );
      }

      const blob = await put(`tours/${fileName}`, buffer, {
        access: "public",
        contentType: file.type,
        token
      });
      return NextResponse.json({ path: blob.url }, { status: 200 });
    }

    const relPath = `/tours/${fileName}`;
    const uploadDir = path.join(process.cwd(), "public", "tours");
    const absPath = path.join(uploadDir, fileName);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(absPath, buffer);

    return NextResponse.json({ path: relPath }, { status: 200 });
  } catch (err) {
    console.error("[upload-tour-image] failed", err);
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
