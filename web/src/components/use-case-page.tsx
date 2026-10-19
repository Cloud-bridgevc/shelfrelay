import { ButtonLink, Card } from "./ui";

export interface UseCaseContent {
  eyebrow: string;
  title: string;
  intro: string;
  challenges: { title: string; body: string }[];
  scenarios: { title: string; body: string; outcome: string }[];
  workflow: string[];
}

export function UseCasePage({ c }: { c: UseCaseContent }) {
  return (
    <>
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-100">{c.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{c.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">{c.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/demo" variant="accent" size="lg">
              Request a demo
            </ButtonLink>
            <ButtonLink href="/app" variant="inverse" size="lg">
              Explore the demo workspace
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-navy-900">What gets in the way today</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {c.challenges.map((x) => (
              <Card key={x.title} className="p-6">
                <h3 className="font-semibold text-navy-900">{x.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{x.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-navy-50/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-navy-900">How teams use ShelfRelay</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {c.scenarios.map((s) => (
              <Card key={s.title} className="flex flex-col p-6">
                <h3 className="font-semibold text-navy-900">{s.title}</h3>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-slate-600">{s.body}</p>
                <p className="mt-5 border-t border-slate-100 pt-4 text-[13px] font-medium text-accent-700">{s.outcome}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-navy-900">A typical week</h2>
            <p className="mt-3 text-slate-600">The workflow fits around how buying already happens, and keeps every number traceable.</p>
          </div>
          <ol className="space-y-3">
            {c.workflow.map((w, i) => (
              <li key={w} className="flex gap-4 rounded-lg border border-slate-200 p-4">
                <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[12px] font-semibold text-white">{i + 1}</span>
                <span className="pt-0.5 text-[15px] text-slate-700">{w}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
