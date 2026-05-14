import { NextRequest } from "next/server";
import { createReadStream, statSync } from "node:fs";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const job = await prisma.renderJob.findUnique({ where: { id: params.jobId } });
  if (!job || !job.outputPath) return new Response("not found", { status: 404 });
  let size: number;
  try { size = statSync(job.outputPath).size; }
  catch { return new Response("file missing", { status: 410 }); }
  const stream = createReadStream(job.outputPath);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="video-${job.id}.mp4"`,
    },
  });
}
