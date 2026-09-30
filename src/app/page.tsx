import { SITE_NAME } from "@/config/site";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        {SITE_NAME}
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Project scaffold is ready. Start building in{" "}
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
          src/
        </code>
        .
      </p>
    </main>
  );
}
