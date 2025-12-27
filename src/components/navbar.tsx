"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { cn } from "@/lib/utils"
import { Home, MessageCircle, Utensils, User } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()

  const navItems = [
    { name: "Home", href: "/dashboard", icon: Home },
    { name: "Coach", href: "/coach", icon: MessageCircle },
    { name: "Restaurants", href: "/restaurants", icon: Utensils },
    { name: "Profile", href: "/profile", icon: User },
  ]

  return (
    <header className="bg-background/80 backdrop-blur-xl border-b border-border/30 sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <span className="text-primary-foreground font-bold text-lg">R</span>
          </div>
          <span className="text-xl font-semibold text-foreground hidden sm:block">Rovia</span>
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
        <div className="flex items-center">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-10 w-10 rounded-full ring-2 ring-border/50 hover:ring-primary/30 transition-all"
              }
            }}
          />
        </div>
      </div>
    </header>
  )
}
