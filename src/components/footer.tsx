import Link from "next/link"

export function Footer() {
  return (
    <footer className="bg-neutral-900">
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8 lg:px-12">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Rovia</span>
            <span className="text-sm text-white/70">— Your nutrition path</span>
          </div>

          <nav className="flex items-center gap-6">
            <Link href="/about" className="text-sm text-white/70 hover:text-white transition-colors">
              About
            </Link>
            <Link href="/privacy" className="text-sm text-white/70 hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/support" className="text-sm text-white/70 hover:text-white transition-colors">
              Support
            </Link>
          </nav>
        </div>

        <div className="mt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Rovia. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
