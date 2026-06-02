import Link from "next/link"
import { Button } from "@/components/ui/button"
import { BarChart3, Users, Calendar, Zap, ArrowRight, Building2, Briefcase, TrendingUp, Landmark, Globe, Shield, UserPlus, Upload, Rocket, Check, Minus } from "lucide-react"
import { TestimonialCard } from "@/components/ui/testimonial-card"
import { Marquee } from "@/components/ui/marquee"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { PublicNav } from "@/components/marketing/PublicNav"
import { PublicFooter } from "@/components/marketing/PublicFooter"

const features = [
    {
        icon: BarChart3,
        title: "Pipeline Management",
        description: "Visual Kanban boards to track every deal from lead to close. Drag-and-drop simplicity with powerful automation.",
    },
    {
        icon: Users,
        title: "Contact Management",
        description: "Centralized contact database with custom fields, tags, and full communication history in one place.",
    },
    {
        icon: Calendar,
        title: "Calendar & Tasks",
        description: "Built-in calendar with Google Calendar sync, task management, and automated follow-up reminders.",
    },
    {
        icon: Zap,
        title: "Automation",
        description: "Email sequences, stage automations, and workflow triggers that save hours of manual work every week.",
    },
]

const testimonials = [
    {
        author: { name: "Sarah Chen", role: "Sales Director", company: "Meridian Properties" },
        text: "We switched from Salesforce and haven't looked back. Vesta is so much simpler and our team actually uses it every day now.",
    },
    {
        author: { name: "Marcus Johnson", role: "Broker", company: "Apex Realty Group" },
        text: "The pipeline view gives me instant clarity on where every deal stands. I've closed 30% more deals since switching.",
    },
    {
        author: { name: "Emily Rodriguez", role: "Team Lead", company: "Summit Partners" },
        text: "Finally a CRM that doesn't require a consultant to set up. We were fully running within a day.",
    },
    {
        author: { name: "David Park", role: "VP Sales", company: "Coastal Ventures" },
        text: "The calendar sync and task reminders mean nothing falls through the cracks anymore. Game changer for our team.",
    },
    {
        author: { name: "Lisa Thompson", role: "Managing Partner", company: "Ironclad Capital" },
        text: "Vesta replaced three separate tools for us — CRM, task manager, and email sequences. Worth every penny.",
    },
]

const testimonialsRow2 = [
    {
        author: { name: "James Wilson", role: "Account Executive", company: "Vertex Solutions" },
        text: "I used to spend hours updating our old CRM. With Vesta, everything updates as I work. It just stays out of the way.",
    },
    {
        author: { name: "Rachel Kim", role: "Operations Manager", company: "Greenfield Homes" },
        text: "The document management and e-signatures saved us so much time. Our clients love how professional it looks.",
    },
    {
        author: { name: "Tom Bradley", role: "Founder", company: "Bradley & Associates" },
        text: "As a small brokerage, we needed something powerful but affordable. Vesta's free plan got us started and we upgraded naturally.",
    },
    {
        author: { name: "Nina Patel", role: "Sales Manager", company: "Horizon Group" },
        text: "The reporting and leaderboard features have made our weekly meetings so much more productive. The team loves the friendly competition.",
    },
    {
        author: { name: "Alex Moreno", role: "Real Estate Agent", company: "Premier Estates" },
        text: "Drag-and-drop pipeline is so intuitive. I can rearrange my deals in seconds and always know what to prioritize.",
    },
]

const steps = [
    {
        icon: UserPlus,
        step: "1",
        title: "Sign up in seconds",
        description: "Create your free account and invite your team. No credit card, no long forms.",
    },
    {
        icon: Upload,
        step: "2",
        title: "Import your contacts",
        description: "Bring your existing data with CSV import or add contacts manually as you go.",
    },
    {
        icon: Rocket,
        step: "3",
        title: "Start closing deals",
        description: "Build your pipeline, set up automations, and watch your revenue grow.",
    },
]

const comparisonFeatures = [
    { name: "Free plan available", vesta: true, salesforce: false, hubspot: true },
    { name: "No per-user pricing", vesta: true, salesforce: false, hubspot: false },
    { name: "Setup in under 5 minutes", vesta: true, salesforce: false, hubspot: false },
    { name: "Built-in document management", vesta: true, salesforce: false, hubspot: false },
    { name: "Google Calendar sync", vesta: true, salesforce: true, hubspot: true },
    { name: "Email sequences", vesta: true, salesforce: true, hubspot: true },
    { name: "Kanban pipeline", vesta: true, salesforce: true, hubspot: true },
    { name: "No consultant required", vesta: true, salesforce: false, hubspot: true },
]

const faqs = [
    {
        question: "Is there really a free plan?",
        answer: "Yes! Our free plan includes up to 100 contacts, 2 team members, pipeline management, task & calendar management, and Google Calendar sync. No credit card required.",
    },
    {
        question: "Can I import my data from another CRM?",
        answer: "Absolutely. You can import contacts, deals, and notes via CSV upload. Our import wizard maps your columns automatically, so you're up and running in minutes.",
    },
    {
        question: "How does billing work?",
        answer: "We offer monthly and yearly billing through Stripe. Yearly plans save you 20%. You can upgrade, downgrade, or cancel at any time — changes take effect at the end of your billing period.",
    },
    {
        question: "Is my data secure?",
        answer: "Your data is stored in Google Firebase with encryption at rest and in transit. We use hashed passwords, CSRF protection, and HTTPS enforcement. We never sell or share your data.",
    },
    {
        question: "Can I use Vesta on mobile?",
        answer: "Yes. Vesta is a progressive web app (PWA) that works great on phones and tablets. Add it to your home screen for a native app experience with push notifications.",
    },
    {
        question: "What happens when I hit my contact limit?",
        answer: "You'll see a prompt to upgrade when you approach your plan's contact limit. Your existing data is never deleted — you just won't be able to add new contacts until you upgrade.",
    },
]

export default function HomePage() {
    return (
        <div className="landing-grain relative overflow-x-clip">
            {/* Animated background orbs */}
            <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
                <div className="landing-orb-home landing-orb-home-1" />
                <div className="landing-orb-home landing-orb-home-2" />
                <div className="landing-orb-home landing-orb-home-3" />
                <div className="landing-orb-home landing-orb-home-4" />
            </div>

            <PublicNav />

            <main>
                <section className="relative">
                    <div className="relative mx-auto max-w-5xl px-6 py-28 lg:py-24">
                        <div className="relative z-10 mx-auto max-w-2xl text-center">
                            <h1 className="text-balance text-4xl font-semibold md:text-5xl lg:text-6xl">Your sales pipeline, <span className="bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">perfected</span></h1>
                            <p className="mx-auto my-8 max-w-2xl text-xl text-muted-foreground">
                                The all-in-one CRM that helps your team manage contacts, automate follow-ups, and close deals faster &mdash; without the complexity.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                <Button
                                    asChild
                                    size="lg">
                                    <Link href="/register">
                                        <span>Start Free</span>
                                        <ArrowRight className="ml-1 h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button
                                    asChild
                                    variant="outline"
                                    size="lg">
                                    <Link href="/pricing">
                                        <span>See Pricing</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto -mt-16 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
                        <div className="[perspective:1200px] [mask-image:linear-gradient(to_right,black_50%,transparent_100%)] -mr-16 pl-16 lg:-mr-56 lg:pl-56">
                            <div className="[transform:rotateX(20deg)]">
                                <div className="lg:h-[44rem] relative skew-x-[.36rad]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        className="rounded-2xl z-[2] relative border dark:hidden"
                                        src="https://tailark.com/_next/image?url=%2Fcard.png&w=3840&q=75"
                                        alt="Vesta CRM dashboard preview"
                                        width={3840}
                                        height={2160}
                                    />
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        className="rounded-2xl z-[2] relative hidden border dark:block"
                                        src="https://tailark.com/_next/image?url=%2Fdark-card.webp&w=3840&q=75"
                                        alt="Vesta CRM dashboard preview"
                                        width={3840}
                                        height={2160}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Logo Cloud */}
                <section className="relative z-10 py-12 border-t border-border/50">
                    <p className="text-center text-sm font-medium text-muted-foreground mb-8">Trusted by growing teams at</p>
                    <Marquee duration={30} pauseOnHover fade fadeAmount={8}>
                        {[
                            { icon: Building2, name: "Meridian Properties" },
                            { icon: Briefcase, name: "Apex Realty Group" },
                            { icon: TrendingUp, name: "Summit Partners" },
                            { icon: Landmark, name: "Coastal Ventures" },
                            { icon: Globe, name: "Ironclad Capital" },
                            { icon: Shield, name: "Vertex Solutions" },
                            { icon: Building2, name: "Greenfield Homes" },
                            { icon: Briefcase, name: "Horizon Group" },
                        ].map((company) => (
                            <div key={company.name} className="flex items-center gap-2 mx-8 text-muted-foreground/60">
                                <company.icon className="h-5 w-5" />
                                <span className="text-sm font-medium whitespace-nowrap">{company.name}</span>
                            </div>
                        ))}
                    </Marquee>
                </section>

                {/* How It Works */}
                <section className="relative z-10 py-16 sm:py-24 border-t border-border/50">
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                                Up and running in minutes
                            </h2>
                            <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
                                No consultants, no complex setup. Just sign up and start selling.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                            {steps.map((s, i) => (
                                <div key={s.step} className="relative text-center">
                                    {i < steps.length - 1 && (
                                        <div className="hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-border" />
                                    )}
                                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 relative">
                                        <s.icon className="h-7 w-7 text-primary" />
                                        <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                            {s.step}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold">{s.title}</h3>
                                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{s.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section id="features" className="relative z-10 py-16 sm:py-24 border-t border-border/50">
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                                Everything you need to grow
                            </h2>
                            <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
                                Built for teams that want a powerful CRM without the complexity.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {features.map((feature) => (
                                <div
                                    key={feature.title}
                                    className="rounded-2xl border bg-card p-8 hover:bg-accent/50 transition-colors"
                                >
                                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                                        <feature.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Comparison */}
                <section className="relative z-10 py-16 sm:py-24 border-t border-border/50">
                    <div className="mx-auto max-w-3xl px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                                How Vesta compares
                            </h2>
                            <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
                                All the power, none of the complexity.
                            </p>
                        </div>

                        <div className="rounded-2xl border overflow-hidden">
                            <div className="grid grid-cols-4 gap-0 bg-muted/50 text-sm font-semibold">
                                <div className="p-4" />
                                <div className="p-4 text-center">Vesta</div>
                                <div className="p-4 text-center text-muted-foreground">Salesforce</div>
                                <div className="p-4 text-center text-muted-foreground">HubSpot</div>
                            </div>
                            {comparisonFeatures.map((f, i) => (
                                <div key={f.name} className={`grid grid-cols-4 gap-0 text-sm ${i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
                                    <div className="p-4 font-medium">{f.name}</div>
                                    <div className="p-4 flex justify-center">
                                        {f.vesta ? <Check className="h-4 w-4 text-emerald-500" /> : <Minus className="h-4 w-4 text-muted-foreground/40" />}
                                    </div>
                                    <div className="p-4 flex justify-center">
                                        {f.salesforce ? <Check className="h-4 w-4 text-muted-foreground/60" /> : <Minus className="h-4 w-4 text-muted-foreground/40" />}
                                    </div>
                                    <div className="p-4 flex justify-center">
                                        {f.hubspot ? <Check className="h-4 w-4 text-muted-foreground/60" /> : <Minus className="h-4 w-4 text-muted-foreground/40" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Testimonials */}
                <section className="relative z-10 py-16 sm:py-24 border-t border-border/50 overflow-hidden">
                    <div className="mx-auto max-w-5xl px-6 text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                            Loved by sales teams everywhere
                        </h2>
                        <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
                            See why teams choose Vesta to manage their pipeline.
                        </p>
                    </div>

                    <div className="relative flex flex-col gap-4">
                        {/* Row 1 — scrolls left */}
                        <div className="group flex overflow-hidden [--gap:1rem] [gap:var(--gap)] [--duration:45s]">
                            <div className="flex shrink-0 [gap:var(--gap)] animate-marquee group-hover:[animation-play-state:paused]">
                                {[...Array(4)].map((_, setIndex) =>
                                    testimonials.map((t, i) => (
                                        <TestimonialCard key={`a-${setIndex}-${i}`} {...t} />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Row 2 — scrolls right */}
                        <div className="group flex overflow-hidden [--gap:1rem] [gap:var(--gap)] [--duration:50s]">
                            <div className="flex shrink-0 [gap:var(--gap)] animate-marquee-reverse group-hover:[animation-play-state:paused]">
                                {[...Array(4)].map((_, setIndex) =>
                                    testimonialsRow2.map((t, i) => (
                                        <TestimonialCard key={`b-${setIndex}-${i}`} {...t} />
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-background" />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-background" />
                    </div>
                </section>

                {/* Pricing Preview */}
                <section className="relative z-10 py-16 sm:py-24 border-t border-border/50">
                    <div className="mx-auto max-w-5xl px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                                Simple, transparent pricing
                            </h2>
                            <p className="mt-4 text-muted-foreground text-lg max-w-lg mx-auto">
                                Start free, upgrade when you need more.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                            {[
                                { name: "Free", price: "$0", period: "forever", desc: "Up to 100 contacts, 2 team members", href: "/register" },
                                { name: "Pro", price: "$49", period: "/mo", desc: "Up to 10,000 contacts, 10 team members", href: "/register?plan=pro", featured: true },
                                { name: "Enterprise", price: "$149", period: "/mo", desc: "Unlimited contacts & team members", href: "/register?plan=enterprise" },
                            ].map((plan) => (
                                <div
                                    key={plan.name}
                                    className={`rounded-2xl border p-6 text-center ${plan.featured ? "border-primary/50 bg-primary/5 shadow-sm" : ""}`}
                                >
                                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                                    <div className="mt-3 flex items-baseline justify-center gap-1">
                                        <span className="text-3xl font-bold">{plan.price}</span>
                                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                                    </div>
                                    <p className="mt-3 text-sm text-muted-foreground">{plan.desc}</p>
                                    <Button asChild variant={plan.featured ? "default" : "outline"} size="sm" className="mt-5 w-full">
                                        <Link href={plan.href}>Get Started</Link>
                                    </Button>
                                </div>
                            ))}
                        </div>

                        <p className="text-center mt-8">
                            <Link href="/pricing" className="text-sm text-primary hover:underline font-medium">
                                View full pricing details &rarr;
                            </Link>
                        </p>
                    </div>
                </section>

                {/* FAQ */}
                <section className="relative z-10 py-16 sm:py-24 border-t border-border/50">
                    <div className="mx-auto max-w-2xl px-6">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                                Frequently asked questions
                            </h2>
                            <p className="mt-4 text-muted-foreground text-lg">
                                Everything you need to know before getting started.
                            </p>
                        </div>

                        <Accordion type="single" collapsible className="w-full">
                            {faqs.map((faq, i) => (
                                <AccordionItem key={i} value={`faq-${i}`}>
                                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground">
                                        {faq.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </section>

                {/* CTA */}
                <section className="relative z-10 py-16 sm:py-24 border-t border-border/50">
                    <div className="mx-auto max-w-2xl text-center px-6">
                        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                            Ready to get started?
                        </h2>
                        <p className="mt-4 text-muted-foreground text-lg">
                            Start with our free plan. No credit card required.
                        </p>
                        <div className="mt-8">
                            <Button asChild size="lg">
                                <Link href="/register">
                                    <span>Create Free Account</span>
                                    <ArrowRight className="ml-1 h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            <PublicFooter />
        </div>
    )
}
