"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function Navbar() {
  const pathname = usePathname()

  const navItems = [
    { name: "Dashboard", href: "/" },
    { name: "Log", href: "/log" },
    { name: "Restaurants", href: "/restaurants" },
    { name: "Profile", href: "/profile" },
  ]

  return (
    <header className="bg-neutral-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8 lg:px-12">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          Rovia
        </Link>

        <nav className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-white",
                pathname === item.href ? "text-white" : "text-white/70",
              )}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
