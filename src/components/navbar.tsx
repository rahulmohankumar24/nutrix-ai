"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, Utensils, TrendingUp, Package, User } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()

  // Hide navbar on landing page and auth pages
  const hideOnPaths = ["/", "/auth/signin", "/auth/signup", "/auth/sso-callback"]
  if (hideOnPaths.some(path => pathname === path || pathname.startsWith("/auth/"))) {
    return null
  }

  const navItems = [
    { name: "Home", href: "/dashboard", icon: Home },
    { name: "Restaurants", href: "/restaurants", icon: Utensils },
    { name: "Pantry", href: "/pantry", icon: Package },
    { name: "Analytics", href: "/my-path", icon: TrendingUp },
  ]

  return (
    <header className="bg-primary/30 backdrop-blur-xl border-b border-primary/40 sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
        {/* Logo */}
        <Link href="/dashboard" className="group">
          <span className="text-2xl font-normal text-foreground tracking-[0.08em]">rovia</span>
        </Link>

        {/* Center Navigation */}
        <nav className="flex items-center bg-white/60 rounded-full p-1.5">
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
                    ? "bg-white text-primary shadow-sm"
                    : "text-foreground/70 hover:text-primary hover:bg-white/50"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="hidden md:block">{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Profile Link */}
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
            pathname === "/profile"
              ? "bg-white text-primary"
              : "bg-white/60 text-foreground/70 hover:bg-white hover:text-primary"
          )}
        >
          <User className="h-4 w-4" />
          <span>Profile</span>
        </Link>
      </div>
    </header>
  )
}
