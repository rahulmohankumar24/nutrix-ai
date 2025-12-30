"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useUser } from "@clerk/nextjs"
import { Mail, Crown } from "lucide-react"

export function Footer() {
  const pathname = usePathname()
  const { user, isSignedIn } = useUser()
  const [isPro, setIsPro] = useState(false)

  useEffect(() => {
    if (isSignedIn && user?.id) {
      fetch(`/api/profile?userId=${user.id}`)
        .then(res => res.json())
        .then(data => setIsPro(data.profile?.isPro || false))
        .catch(() => setIsPro(false))
    }
  }, [isSignedIn, user?.id])

  // Hide footer on landing page and auth pages
  const hideOnPaths = ["/", "/auth/signin", "/auth/signup", "/auth/sso-callback"]
  if (hideOnPaths.some(path => pathname === path || pathname.startsWith("/auth/"))) {
    return null
  }

  return (
    <footer className="bg-primary/50 backdrop-blur-xl border-t border-primary/60">
      <div className="mx-auto max-w-6xl px-8 py-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center p-1.5">
              <Image
                src="/notext.png"
                alt="Rovia"
                width={32}
                height={32}
                className="h-full w-full object-contain"
              />
            </div>
            <span className="text-lg font-normal text-foreground tracking-[0.08em]">rovia</span>
          </div>

          <div className="flex items-center gap-3">
            {!isPro && (
              <Link
                href="/pro"
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Crown className="h-4 w-4" />
                <span>Go Pro</span>
              </Link>
            )}
            <a
              href="mailto:rovianutrition@gmail.com"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 text-foreground/70 text-sm font-medium hover:bg-white hover:text-primary transition-all"
            >
              <Mail className="h-4 w-4" />
              <span>Contact</span>
            </a>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-primary/20 text-center text-xs text-foreground/50">
          {new Date().getFullYear()} Rovia. Personalized nutrition, powered by AI.
        </div>
      </div>
    </footer>
  )
}
