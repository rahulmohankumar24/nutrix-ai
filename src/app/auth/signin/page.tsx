'use client'

import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function SignIn() {
  const router = useRouter()

  useEffect(() => {
    // Check if user is already signed in
    getSession().then((session) => {
      if (session) {
        router.push('/dashboard')
      }
    })
  }, [router])

  const handleGoogleSignIn = () => {
    signIn('google', {
      callbackUrl: '/onboarding',
      redirect: true
    })
  }

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <h1 className="text-4xl font-bold text-white">Mootra AI</h1>
          </div>
          <p className="text-gray-400 text-lg">Your AI-powered nutrition coach</p>
        </div>

        <div className="glass py-8 px-6 rounded-2xl">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-3">
                Welcome back
              </h2>
              <p className="text-gray-400 text-sm">
                Get personalized meal recommendations powered by AI
              </p>
            </div>

            <div>
              <button
                onClick={handleGoogleSignIn}
                className="w-full flex justify-center items-center px-6 py-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl text-white font-medium transition-all group"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            </div>

            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-gray-900 text-gray-400">Why Google?</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="grid grid-cols-1 gap-3 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Secure authentication</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>No password to remember</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Quick and easy setup</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}