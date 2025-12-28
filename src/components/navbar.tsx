"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Utensils, TrendingUp, Package, User } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()

  const navItems = [
    { name: "Home", href: "/dashboard", icon: Home },
    { name: "Restaurants", href: "/restaurants", icon: Utensils },
    { name: "Pantry", href: "/pantry", icon: Package },
    { name: "Analytics", href: "/my-path", icon: TrendingUp },
  ]

  return (
    <header className="bg-background/80 backdrop-blur-xl border-b border-border/30 sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
        {/* Logo */}
        <Link href="/dashboard" className="group">
          <span className="text-2xl font-normal text-foreground tracking-[0.08em]">rovia</span>
        </Link>

        {/* Center Navigation */}
        <nav className="flex items-center bg-muted/50 rounded-full p-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/")

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-base font-medium transition-all",
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className="hidden md:block">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Profile Link */}
        <Link
          href="/profile"
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center transition-all",
            pathname === "/profile"
              ? "bg-primary/10 text-primary ring-2 ring-primary/30"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <User className="h-5 w-5" />
        </Link>
      </div>
    </header>
  )
}
