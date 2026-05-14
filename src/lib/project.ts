import { prisma } from "./db";

export async function getOrCreateDefaultProject() {
  const existing = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.project.create({ data: { title: "My Project" } });
}

export function assetUrl(id: string) {
  return `/api/assets/${id}/file`;
}
