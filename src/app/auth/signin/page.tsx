import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <h1 className="text-4xl font-bold text-white">Rovia</h1>
          </div>
          <p className="text-gray-400 text-lg">Your AI-powered nutrition coach</p>
        </div>

        <div className="flex justify-center">
          <SignIn
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 shadow-2xl"
              }
            }}
            routing="path"
            path="/auth/signin"
            signUpUrl="/auth/signup"
            afterSignInUrl="/onboarding"
          />
        </div>
      </div>
    </div>
  )
}
