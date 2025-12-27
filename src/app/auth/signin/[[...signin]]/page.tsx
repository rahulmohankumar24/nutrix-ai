import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-6">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-10">
          <span className="text-4xl font-normal text-foreground tracking-[0.08em]">rovia</span>
          <p className="text-muted-foreground mt-4">Sign in to continue</p>
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
