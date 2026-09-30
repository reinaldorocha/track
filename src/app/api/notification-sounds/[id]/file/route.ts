import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { ensureNotificationSoundTable } from "@/lib/db/ensure-tables";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Não autorizado", { status: 401 });
    }

    const { id } = await params;

    await ensureNotificationSoundTable();

    const sound = await prisma.notificationSound.findUnique({
      where: { id },
      include: { workspace: true },
    });

    if (!sound || !sound.storagePath) {
      return new Response("Arquivo não encontrado", { status: 404 });
    }

    // Verificar se o usuário é membro do workspace dono do som
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: sound.workspaceId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return new Response("Acesso negado", { status: 403 });
    }

    if (!fs.existsSync(sound.storagePath)) {
      return new Response("Arquivo não encontrado no disco", { status: 404 });
    }

    const stat = await fsPromises.stat(sound.storagePath);
    const fileSize = stat.size;
    const mimeType = sound.mimeType || "audio/mpeg";

    const range = req.headers.get("range");

    if (range) {
      // Suporte a HTTP 206 Partial Content para seek/streaming suave em iOS/Android
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        return new Response(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const fileBuffer = Buffer.alloc(chunkSize);
      const fd = await fsPromises.open(sound.storagePath, "r");
      await fd.read(fileBuffer, 0, chunkSize, start);
      await fd.close();

      return new Response(fileBuffer, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Retorno completo do arquivo
    const fileBuffer = await fsPromises.readFile(sound.storagePath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${sound.originalFileName}"`,
      },
    });
  } catch (error: any) {
    console.error("[Sound File Stream API] Error:", error);
    return new Response("Erro interno ao carregar arquivo de som", { status: 500 });
  }
}
