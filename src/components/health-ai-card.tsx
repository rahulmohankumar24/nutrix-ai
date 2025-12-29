"use client"

import { Shield, Crown, Lock, ArrowUpRight, Info } from "lucide-react"
import Link from "next/link"

interface HealthAICardProps {
  userId: string
  isPro?: boolean
}

export function HealthAICard({ isPro = false }: HealthAICardProps) {
  // Non-Pro locked state
  if (!isPro) {
    return (
      <Link href="/insights/health" className="block group">
        <div className="bg-card rounded-2xl p-5 border border-border/50 hover:border-emerald-500/30 hover:shadow-lg transition-all relative overflow-hidden h-full">
          {/* Pro badge */}
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-600">PRO</span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-emerald-500" />
            </div>
            <h3 className="font-semibold text-foreground">Ingredient Insights</h3>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Learn what's in your restaurant meals and make informed choices.
          </p>

          {/* Locked preview */}
          <div className="relative">
            <div className="space-y-2 opacity-50 blur-[2px]">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-green-600">B</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Health Score: 78</p>
                  <p className="text-xs text-muted-foreground">12 meals analyzed</p>
                </div>
              </div>
            </div>

            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium shadow-lg">
                <Lock className="h-4 w-4" />
                Upgrade to Pro
              </div>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  // Pro user - simple teaser card (no data fetching here)
  return (
    <Link href="/insights/health" className="block group">
      <div className="bg-card rounded-2xl p-5 border border-border/50 hover:border-emerald-500/30 hover:shadow-lg transition-all h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-emerald-500" />
            </div>
            <h3 className="font-semibold text-foreground">Ingredient Insights</h3>
          </div>
          <ArrowUpRight className="h-5 w-5 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          See what's in your restaurant meals and get personalized insights.
        </p>

        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <Info className="h-4 w-4" />
          <span>Tap to view your analysis</span>
        </div>
      </div>
    </Link>
  )
}
