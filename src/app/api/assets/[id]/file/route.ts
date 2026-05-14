import { NextRequest } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: params.id } });
  if (!asset) return new Response("not found", { status: 404 });

  let size: number;
  try { size = statSync(asset.storagePath).size; }
  catch { return new Response("file missing", { status: 410 }); }

  const nodeStream = createReadStream(asset.storagePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new Response(webStream, {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
