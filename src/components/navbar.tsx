"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { Home, Utensils, TrendingUp, Package } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()

  const navItems = [
    { name: "Home", href: "/dashboard", icon: Home },
    { name: "Restaurants", href: "/restaurants", icon: Utensils },
    { name: "Pantry", href: "/pantry", icon: Package },
    { name: "My Path", href: "/my-path", icon: TrendingUp },
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

        {/* User Button */}
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-24 w-24 rounded-full ring-2 ring-border/50 hover:ring-primary/30 transition-all"
            }
          }}
        />
      </div>
    </header>
  )
}
