import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold text-xs">R</span>
            </div>
            <div>
              <span className="text-sm font-medium text-foreground">Rovia</span>
              <span className="text-sm text-muted-foreground ml-2">Find your path</span>
            </div>
          </div>

          <nav className="flex items-center gap-6">
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/support" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Support
            </Link>
          </nav>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground/70">
          {new Date().getFullYear()} Rovia
        </div>
      </div>
    </footer>
  )
}
