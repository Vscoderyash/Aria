import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Owner Login",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials.username === "yash_owner" &&
          credentials.password === "owner_yash123"
        ) {
          return { id: 1, name: "Yash (Owner)", role: "admin" };
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  secret: "aria_secrect_login_yash180", // Your custom secret string
});

export { handler as GET, handler as POST };
