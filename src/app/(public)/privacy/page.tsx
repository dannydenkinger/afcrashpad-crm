import { PublicNav } from "@/components/marketing/PublicNav"
import { PublicFooter } from "@/components/marketing/PublicFooter"

export const metadata = {
    title: "Privacy Policy | AFCrashpad CRM",
}

export default function PrivacyPage() {
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
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground mb-10">Last updated: March 2026</p>

                <div className="prose dark:prose-invert max-w-none prose-headings:tracking-tight prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-violet-500 prose-strong:text-foreground">
                    <h2>1. Information We Collect</h2>
                    <p>
                        When you create an account, we collect your name, email address, and password.
                        When you use our services, we collect data you enter into the CRM including
                        contacts, deals, tasks, documents, and communications.
                    </p>

                    <h2>2. How We Use Your Information</h2>
                    <p>We use your information to:</p>
                    <ul>
                        <li>Provide and maintain our CRM services</li>
                        <li>Authenticate your identity and manage your account</li>
                        <li>Send transactional emails (account verification, password resets, notifications)</li>
                        <li>Improve our services and develop new features</li>
                    </ul>

                    <h2>3. Data Storage & Security</h2>
                    <p>
                        Your data is stored in Google Firebase (Firestore) with encryption at rest and in transit.
                        We use industry-standard security practices including hashed passwords, JWT authentication,
                        CSRF protection, and HTTPS enforcement.
                    </p>

                    <h2>4. Third-Party Services</h2>
                    <p>We use the following third-party services to operate AFCrashpad CRM:</p>
                    <ul>
                        <li><strong>Google Firebase</strong> &mdash; Database and file storage</li>
                        <li><strong>Google OAuth</strong> &mdash; Optional sign-in with Google</li>
                        <li><strong>Stripe</strong> &mdash; Payment processing (we do not store credit card numbers)</li>
                        <li><strong>Resend</strong> &mdash; Transactional email delivery</li>
                    </ul>

                    <h2>5. Data Sharing</h2>
                    <p>
                        We do not sell, trade, or rent your personal information. We only share data with the
                        third-party services listed above as necessary to operate our service.
                    </p>

                    <h2>6. Your Rights</h2>
                    <p>You have the right to:</p>
                    <ul>
                        <li>Access your personal data</li>
                        <li>Export your data</li>
                        <li>Request deletion of your account and data</li>
                        <li>Update or correct your information</li>
                    </ul>

                    <h2>7. Cookies</h2>
                    <p>
                        We use essential cookies for authentication (session tokens). We may use analytics
                        cookies (Google Analytics) to understand how our service is used. No advertising cookies are used.
                    </p>

                    <h2>8. Changes to This Policy</h2>
                    <p>
                        We may update this policy from time to time. We will notify you of significant changes
                        via email or an in-app notification.
                    </p>

                    <h2>9. Contact</h2>
                    <p>
                        If you have questions about this privacy policy, please contact us at{" "}
                        <a href="mailto:support@afcrashpad.com">support@afcrashpad.com</a>.
                    </p>
                </div>
            </main>

            <PublicFooter />
        </div>
    )
}
