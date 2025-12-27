import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-6">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold text-lg">R</span>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1">Sign in to continue your journey</p>
        </div>

        <div className="flex justify-center">
          <SignIn
            appearance={{
              elements: {
                rootBox: "mx-auto w-full",
                card: "bg-card border border-border shadow-sm rounded-2xl",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                socialButtonsBlockButton: "bg-muted border-0 hover:bg-muted/80",
                formButtonPrimary: "bg-primary hover:opacity-90",
                footerActionLink: "text-primary hover:text-primary/80"
              }
            }}
            routing="path"
            path="/auth/signin"
            signUpUrl="/auth/signup"
            forceRedirectUrl="/dashboard"
          />
        </div>
      </div>
    </div>
  )
}
