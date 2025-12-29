import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

export default function Page() {
  const { userId } = auth();

  if (userId) {
    redirect("/chat");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
            Chat Platform
          </h1>
          <p className="text-slate-400">
            Secure internal communication
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-800">
          <div className="space-y-4">
            {/* Primary Action */}
            <Link
              href="/sign-in"
              className="w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              LOG IN
            </Link>

            {/* Secondary Action */}
            <Link
              href="/sign-up"
              className="w-full flex justify-center py-4 px-4 border border-slate-700 rounded-xl shadow-sm text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              CREATE ACCOUNT
            </Link>
          </div>
        </div>

        {/* Footer / Version */}
        <div className="text-center">
          <span className="text-xs text-slate-600 font-mono">v5.0 - Secure Access</span>
        </div>
      </div>
    </div>
  );
}
