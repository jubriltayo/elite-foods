import { checkSupabase } from "@/lib/foundation";
import { DELIVERY_AREAS, SHOP } from "@/lib/config/business";
import { formatNaira } from "@/lib/format";

export default async function Home() {
  const supabase = await checkSupabase();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {SHOP.name}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Foundation slice: Next.js, TypeScript, Tailwind, Supabase schema and
          seed data.
        </p>
      </header>

      <section className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.14]">
        <h2 className="mb-2 font-medium">Supabase</h2>
        {supabase.ok ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Connected. {supabase.products} products seeded.
          </p>
        ) : (
          <div className="text-sm">
            <p className="text-red-600 dark:text-red-400">
              Not connected: {supabase.error}
            </p>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Fill in <code className="font-mono">.env.local</code> from{" "}
              <code className="font-mono">.env.example</code>, then run{" "}
              <code className="font-mono">supabase db reset</code> to apply the
              migration and seed data.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-black/[.08] p-4 dark:border-white/[.14]">
        <h2 className="mb-2 font-medium">Delivery</h2>
        <ul className="text-sm text-zinc-600 dark:text-zinc-400">
          {Object.entries(DELIVERY_AREAS).map(([id, area]) => (
            <li key={id}>
              {area.label} — {formatNaira(area.fee)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
