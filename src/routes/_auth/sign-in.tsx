import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { Badge } from '#/components/ui/badge'

export const Route = createFileRoute('/_auth/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="ops-shell rounded-[2.4rem] px-6 py-8 md:px-10 md:py-10">
        <Badge variant="outline" className="rounded-full border-border/60 bg-background/60">
          Demo access
        </Badge>
        <h1 className="ops-title mt-6 text-5xl md:text-7xl">
          Enter the command surface without losing the feel of a crafted product.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
          This frontend-first pass scaffolds the multitenant shell, grouped
          navigation, theme controls, and locale switching so inventory,
          restaurant, POS, and system admin work can grow inside one clear frame.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full px-5">
            <Link to="/dashboard">Open dashboard</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="rounded-full px-5"
          >
            <Link to="/select-tenant">Choose workspace</Link>
          </Button>
        </div>
      </div>

      <div className="ops-panel rounded-[2rem] p-6 md:p-8">
        <span className="ops-kicker">What landed in this pass</span>
        <ul className="mt-6 flex flex-col gap-4 text-sm leading-7 text-muted-foreground">
          <li>Creative operations shell with a collapsible sidebar.</li>
          <li>
            Four grouped menu domains: Inventory, Restaurant, POS, and System
            Admin.
          </li>
          <li>Theme toggle, language switcher, and workspace switcher.</li>
          <li>
            Foundation files for query, i18n, env parsing, Prisma, and tests.
          </li>
        </ul>
      </div>
    </section>
  )
}
