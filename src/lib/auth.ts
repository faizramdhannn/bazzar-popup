// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { readSheet } from "./sheets";
import { SessionUser } from "@/types";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const users = await readSheet("users");
        const user = users.find(
          (u) => u.username === credentials.username
        );

        if (!user) return null;

        // Support plain text password (for initial setup) or bcrypt hash
        let valid = false;
        if (user.password.startsWith("$2")) {
          valid = await bcrypt.compare(credentials.password, user.password);
        } else {
          valid = credentials.password === user.password;
        }

        if (!valid) return null;

        return {
          id: user.user_id,
          name: user.username,
          email: user.username,
          role: user.role,
        } as SessionUser & { name: string; email: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as SessionUser & { name: string }).role;
        token.username = (user as SessionUser & { name: string }).name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser & { name: string; email: string }).id =
          token.id as string;
        (session.user as SessionUser & { name: string; email: string }).role =
          token.role as "admin" | "staff";
        (session.user as SessionUser & { name: string; email: string }).username =
          token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
