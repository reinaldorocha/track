import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "utm-track-jwt-production-secret-auth-key-2025-at-least-32-chars",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          console.error("[auth] Erro de validação:", parsed.error.format());
          return null;
        }

        const email = parsed.data.email.trim().toLowerCase();
        const { password } = parsed.data;

        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.password) {
            console.error("[auth] Usuário não encontrado:", email);
            return null;
          }

          // Bloqueio de usuários suspensos ou desativados
          const status = String(user.status || "ACTIVE").toUpperCase();
          if (status === "SUSPENDED" || status === "DISABLED") {
            console.warn(`[auth] Tentativa de login de usuário bloqueado (${status}): ${email}`);
            throw new Error("USER_SUSPENDED");
          }

          const passwordMatch = await bcrypt.compare(password, user.password);
          if (!passwordMatch) {
            console.error("[auth] Senha não confere para:", email);
            return null;
          }

          // Verificar se o usuário deve ser promovido a ADMIN via bootstrap inicial
          const adminEmail = String(process.env.ADMIN_EMAIL || process.env.INITIAL_ADMIN_EMAIL || "").toLowerCase().trim();
          let effectiveRole = String(user.role || "CLIENT").toUpperCase();

          if (adminEmail && email === adminEmail && effectiveRole !== "ADMIN" && effectiveRole !== "SUPER_ADMIN") {
            await prisma.user.update({
              where: { id: user.id },
              data: { role: "ADMIN" },
            });
            effectiveRole = "ADMIN";
          }

          // Atualizar timestamp do último login
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          }).catch(() => {});

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: effectiveRole,
            status: user.status || "ACTIVE",
          };
        } catch (dbErr) {
          if (dbErr instanceof Error && dbErr.message === "USER_SUSPENDED") {
            throw dbErr;
          }
          console.error("[auth] Erro no banco durante login:", dbErr);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role || "CLIENT";
        token.status = (user as any).status || "ACTIVE";
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        if (token.email) session.user.email = token.email as string;
        if (token.name) session.user.name = token.name as string;
        (session.user as any).role = (token.role as string) || "CLIENT";
        (session.user as any).status = (token.status as string) || "ACTIVE";
      }
      return session;
    },
  },
});

