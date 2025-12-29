import { SignIn, auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default function Page() {
  const { userId } = auth();

  // Redirect if already logged in
  if (userId) {
    redirect("/chat");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Internal Chat Platform</h1>
          <p className="text-slate-400">Please sign in to access the secure chat</p>
          {/* Debugging text to confirm if this version is rendered */}
          <span className="text-[10px] text-slate-800">RENDERED_v4</span>
        </div>

        <div className="bg-white rounded-2xl p-2 shadow-2xl">
          <SignIn
            afterSignInUrl="/chat"
            afterSignUpUrl="/chat"
            appearance={{
              elements: {
                rootBox: "mx-auto w-full",
                card: "shadow-none border-none p-4",
              }
            }}
          />
        </div>

        <div className="mt-6 text-center">
          <p className="text-slate-500 text-sm">
            Don't have an account? The signup link is inside the box above.
          </p>
        </div>
      </div>
    </div>
  );
}
