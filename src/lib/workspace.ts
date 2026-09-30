import { prisma } from "@/lib/db";

export async function getUserWorkspaceId(userId: string): Promise<string | null> {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (member) return member.workspaceId;

  // Fallback: check if user has any workspace or create a default one
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const slug = `ws-${userId.slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
  const workspace = await prisma.workspace.create({
    data: {
      name: `${user.name || "Meu"} Workspace`,
      slug,
      members: {
        create: {
          userId: user.id,
          role: "owner",
        },
      },
    },
  });

  return workspace.id;
}
