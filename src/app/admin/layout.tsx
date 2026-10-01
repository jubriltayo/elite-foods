import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { NotAuthorisedError, requireAdminProfile } from "@/lib/admin";
import { getCurrentProfile } from "@/lib/profiles";

/**
 * Admin route guard (TRD section 21, section 28).
 *
 * Guards the pages in this segment. This is NOT sufficient on its own: the
 * server actions in `actions.ts` re-authorize independently, because an action
 * can be invoked without ever rendering this layout (AGENTS.md section 6).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let authorised = true;

  try {
    await requireAdminProfile();
  } catch (error) {
    if (error instanceof NotAuthorisedError) {
      authorised = false;
    } else {
      // An unexpected failure (e.g. the database is down) must not silently
      // render the dashboard.
      throw error;
    }
  }

  if (!authorised) {
    // The session is resolved separately so a signed-out visitor gets sent to
    // sign in rather than told the admin area does not exist.
    const profile = await getCurrentProfile();

    if (!profile) {
      redirect("/login?callbackUrl=/admin");
    }

    // Signed in but not an admin: 404 rather than 403, so the existence of the
    // admin area is not confirmed (TRD section 28).
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      {/* The admin area reuses the shop's palette but reads operational: same
          brand colour, denser rows, no promotional imagery. */}
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-soft">
        <ol className="flex items-center gap-2">
          <li>
            <Link
              href="/"
              className="underline underline-offset-4 hover:text-ink"
            >
              Shop
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-bold text-ink">
            Admin
          </li>
        </ol>
      </nav>

      {children}
    </div>
  );
}
