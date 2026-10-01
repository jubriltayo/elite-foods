import type { ReactNode } from "react";

/**
 * Page header band.
 *
 * A shared component because the Shop and Admin headers previously drifted apart
 * and produced the same class of bug in both: brand-red text was being placed on
 * the red band, which made the word "counter" invisible.
 *
 * The colour contract here is deliberate and fixed:
 *   - the band is the brand red
 *   - headings and labels are WHITE on red (7.4:1)
 *   - the eyebrow and any accented word are the band accent yellow (5.3:1)
 *   - figures sit in SOLID WHITE chips carrying `--red-fixed`, a scheme-stable
 *     red that is legible on white in both light and dark
 *
 * Nothing in here should ever use `text-brand-ink`, which is a red meant for
 * pale grounds only.
 */
export type PageBandStat = {
  value: number | string;
  label: string;
};

export function PageBand({
  eyebrow,
  title,
  accent,
  description,
  stats,
}: {
  eyebrow: string;
  title: ReactNode;
  /** Trailing words of the title, set in the band accent. */
  accent?: string;
  description?: ReactNode;
  stats?: PageBandStat[];
}) {
  return (
    <section className="band-surface bg-band text-on-band">
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-widest text-band-accent">
          {eyebrow}
        </p>

        <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-[0.9] tracking-tight sm:text-6xl">
          {title}
          {accent && (
            <>
              {" "}
              <span className="text-band-accent">{accent}</span>
            </>
          )}
        </h1>

        {description && (
          <p className="mt-3 text-sm text-on-band/85">{description}</p>
        )}

        {stats && stats.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-3">
            {stats.map((stat) => (
              <li
                key={stat.label}
                className="flex items-baseline gap-2 rounded-full bg-chip-on-band px-4 py-2"
              >
                {/* Scheme-stable red: the dark scheme's brand-ink is a light red
                    and would be unreadable on a white chip. */}
                <span className="tabular font-display text-xl font-extrabold leading-none text-red-fixed">
                  {stat.value}
                </span>
                <span className="text-sm text-ink-soft">{stat.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
