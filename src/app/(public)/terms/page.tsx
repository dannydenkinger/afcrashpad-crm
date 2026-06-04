import { PublicNav } from "@/components/marketing/PublicNav"
import { PublicFooter } from "@/components/marketing/PublicFooter"

export const metadata = {
    title: "Terms of Service | AFCrashpad CRM",
}

export default function TermsPage() {
    return (
        <div className="landing-grain relative min-h-screen overflow-x-clip text-foreground">
            {/* Animated background orbs */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
                <div className="landing-orb-home landing-orb-home-1" />
                <div className="landing-orb-home landing-orb-home-2" />
                <div className="landing-orb-home landing-orb-home-3" />
                <div className="landing-orb-home landing-orb-home-4" />
            </div>

            <PublicNav />

            <main className="relative z-10 mx-auto max-w-3xl px-6 pt-28 pb-20">
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Terms of Service</h1>
                <p className="text-sm text-muted-foreground mb-10">Last updated: March 2026</p>

                <div className="prose dark:prose-invert max-w-none prose-headings:tracking-tight prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-violet-500 prose-strong:text-foreground">
                    <h2>1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using AFCrashpad CRM, you agree to be bound by these Terms of Service.
                        If you do not agree to these terms, do not use our service.
                    </p>

                    <h2>2. Account Terms</h2>
                    <ul>
                        <li>You must provide a valid email address to create an account.</li>
                        <li>You are responsible for maintaining the security of your account and password.</li>
                        <li>You are responsible for all activity that occurs under your account.</li>
                        <li>You must be at least 18 years old to use this service.</li>
                    </ul>

                    <h2>3. Acceptable Use</h2>
                    <p>You agree not to:</p>
                    <ul>
                        <li>Use the service for any illegal or unauthorized purpose</li>
                        <li>Violate any laws in your jurisdiction</li>
                        <li>Upload malicious code or attempt to compromise our systems</li>
                        <li>Resell the service without authorization</li>
                        <li>Use the service to send spam or unsolicited communications</li>
                    </ul>

                    <h2>4. Service & Data</h2>
                    <p>
                        You retain ownership of all data you upload to AFCrashpad CRM. We do not claim any
                        intellectual property rights over your content. We will not access your data except
                        as necessary to provide the service or comply with law.
                    </p>

                    <h2>5. Billing & Cancellation</h2>
                    <ul>
                        <li>Free plans are available with limited features and usage caps.</li>
                        <li>Paid plans are billed monthly or annually via Stripe.</li>
                        <li>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period.</li>
                        <li>We do not offer refunds for partial billing periods.</li>
                    </ul>

                    <h2>6. Service Availability</h2>
                    <p>
                        We strive for high availability but do not guarantee uninterrupted service.
                        We may perform maintenance that temporarily limits access. We will provide
                        reasonable notice of planned downtime when possible.
                    </p>

                    <h2>7. Limitation of Liability</h2>
                    <p>
                        AFCrashpad CRM is provided &ldquo;as is&rdquo; without warranties of any kind. We are not liable
                        for any indirect, incidental, special, or consequential damages arising from your
                        use of the service.
                    </p>

                    <h2>8. Changes to Terms</h2>
                    <p>
                        We reserve the right to modify these terms at any time. We will notify users of
                        significant changes via email. Continued use of the service after changes constitutes
                        acceptance of the new terms.
                    </p>

                    <h2>9. Contact</h2>
                    <p>
                        Questions about these terms? Contact us at{" "}
                        <a href="mailto:support@afcrashpad.com">support@afcrashpad.com</a>.
                    </p>
                </div>
            </main>

            <PublicFooter />
        </div>
    )
}
