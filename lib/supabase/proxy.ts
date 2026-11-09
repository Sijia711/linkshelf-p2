import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeRedirectUrl } from "@/lib/auth";

/**
 * Updates the user's Supabase session and enforces route access boundaries.
 * In Next.js 16, this runs as the network boundary proxy.
 * 
 * Rules:
 * 1. Uses `supabase.auth.getUser()` to cryptographically verify credentials (not getSession).
 * 2. Unauthenticated access to `/dashboard` or `/` redirects to `/login`.
 * 3. Authenticated access to `/login` or `/signup` redirects to `/dashboard`.
 * 4. Preserves session refresh cookies across redirect responses.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // If environment variables are missing (e.g. during minimal build checks), pass through
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Cryptographically verify authentication state with Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isCallbackRoute = pathname.startsWith("/auth/");
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isRootRoute = pathname === "/";

  // Helper to construct a redirect response preserving session cookies
  const createRedirect = (targetUrl: URL): NextResponse => {
    const redirectResponse = NextResponse.redirect(targetUrl);
    supabaseResponse.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c);
    });
    return redirectResponse;
  };

  // 1. Authenticated users trying to access login/signup should go directly to dashboard
  if (user && isAuthRoute) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = "/dashboard";
    targetUrl.search = "";
    return createRedirect(targetUrl);
  }

  // 2. Unauthenticated users trying to access protected routes (/dashboard or root /)
  if (!user && (isDashboardRoute || isRootRoute) && !isCallbackRoute) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = "/login";

    // Set safe redirectTo query param for return navigation
    if (isDashboardRoute) {
      const fullPath = pathname + search;
      targetUrl.searchParams.set("redirectTo", sanitizeRedirectUrl(fullPath, "/dashboard"));
    } else {
      targetUrl.search = "";
    }

    return createRedirect(targetUrl);
  }

  // 3. Authenticated user visiting root / -> redirect to /dashboard
  if (user && isRootRoute) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = "/dashboard";
    return createRedirect(targetUrl);
  }

  return supabaseResponse;
}
