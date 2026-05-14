import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const job = await prisma.renderJob.findUnique({ where: { id: params.jobId } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: job.id,
    projectId: job.projectId,
    status: job.status,
    progress: job.progress,
    videoUrl: job.status === "completed" ? `/api/render/${job.id}/file` : undefined,
    errorMessage: job.errorMessage ?? undefined,
  });
}
