import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/auth/actions";
import BookmarkDashboardClient from "./BookmarkDashboardClient";

export const metadata = {
  title: "Dashboard — LinkShelf",
  description: "Manage your saved bookmarks",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Dashboard Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <span className="text-xl font-bold tracking-tight text-gray-900">
              LinkShelf
            </span>
            <nav className="flex space-x-4">
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-blue-600 hover:text-blue-800"
              >
                Bookmarks
              </Link>
              <Link
                href="/learning-paths"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Learning Paths
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 hidden sm:inline" data-testid="user-email">
              {user.email}
            </span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                data-testid="sign-out-button"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Bookmark Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BookmarkDashboardClient />
      </main>
    </div>
  );
}
