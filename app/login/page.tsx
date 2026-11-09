import Link from "next/link";
import { signInAction } from "@/app/auth/actions";
import { mapAuthError, sanitizeRedirectUrl } from "@/lib/auth";

export const metadata = {
  title: "Sign In — LinkShelf",
  description: "Sign in to access your saved bookmarks on LinkShelf",
};

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; message?: string; redirectTo?: string }>;
}) {
  const searchParams = await props.searchParams;
  const rawError = searchParams?.error;
  const rawMessage = searchParams?.message;
  const safeRedirect = sanitizeRedirectUrl(searchParams?.redirectTo, "/dashboard");

  const errorMessage = rawError ? mapAuthError(rawError) : null;
  const isCheckEmail = rawMessage === "check-email";

  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="text-center block">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            LinkShelf
          </h1>
        </Link>
        <h2 className="mt-2 text-center text-sm text-gray-600">
          Sign in to your personal link library
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-200">
          {isCheckEmail && (
            <div className="mb-4 rounded-md bg-blue-50 p-4 border border-blue-200" role="status">
              <p className="text-sm font-medium text-blue-800">
                Check your email for a confirmation link to activate your account.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 rounded-md bg-red-50 p-4 border border-red-200" role="alert">
              <p className="text-sm font-medium text-red-800">{errorMessage}</p>
            </div>
          )}

          <form action={signInAction} className="space-y-6">
            <input type="hidden" name="redirectTo" value={safeRedirect} />

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-4 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
