import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/profiles";
import { SHOP } from "@/lib/config/business";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/field";
import { signInWithGoogle, signOutAction } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Elite Foods and Snacks.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;

  const raw = searchParams.callbackUrl;
  const requested = Array.isArray(raw) ? raw[0] : raw;

  // Same-origin paths only. An absolute or protocol-relative URL would be an
  // open redirect, so it falls back to the home page.
  const callbackUrl =
    requested &&
    requested.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.startsWith("/login")
      ? requested
      : "/";

  const session = await auth();
  const profile = await getCurrentProfile();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-band-accent">
        {session ? "Your account" : "Welcome"}
      </p>

      <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-none tracking-tight text-ink">
        {session ? "Signed in" : "Sign in"}
      </h1>

      {session && profile ? (
        <>
          <p className="mt-3 text-ink-soft">
            Signed in as {profile.full_name ?? profile.email}
          </p>

          <dl className="mt-6 flex flex-col gap-4 rounded-card border-2 border-ink bg-cream p-5">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Name
              </dt>
              <dd className="mt-0.5 font-bold text-ink">
                {profile.full_name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Email
              </dt>
              <dd className="mt-0.5 break-all font-bold text-ink">
                {profile.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Account type
              </dt>
              <dd className="mt-1">
                <Chip tone={profile.role === "admin" ? "gold" : "neutral"}>
                  {profile.role}
                </Chip>
              </dd>
            </div>
          </dl>

          <form action={signOutAction} className="mt-6">
            <Button type="submit" intent="outline">
              Sign out
            </Button>
          </form>
        </>
      ) : session ? (
        <p className="mt-6 rounded-card border-2 border-berry bg-berry-tint p-4 text-sm font-bold text-berry-ink">
          You are signed in, but no account record was found. Please contact the
          shop.
        </p>
      ) : (
        <>
          <p className="prose-measure mt-3 text-ink-soft">
            Sign in with Google to place an order. Your cart is kept in this
            browser, so nothing is lost.
          </p>

          <form action={signInWithGoogle} className="mt-7">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button type="submit" size="lg" className="w-full">
              Continue with Google
            </Button>
          </form>

          <p className="mt-6 text-xs text-ink-soft">
            {SHOP.name} only uses your email and name to deliver your order.
          </p>
        </>
      )}
    </div>
  );
}
