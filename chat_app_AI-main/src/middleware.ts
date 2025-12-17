import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/sign-in(.*)", "/sign-up(.*)"],
  ignoredRoutes: ["/api/webhooks(.*)"],
  // Skip multi-factor authentication requirement
  afterAuth(auth, req, evt) {
    // Allow access even if MFA is not completed
    return;
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
