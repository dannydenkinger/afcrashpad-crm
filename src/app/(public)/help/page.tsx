import { Metadata } from "next"
import Link from "next/link"
import {
    ArrowLeft, Sparkles, Users, GitBranch, Mail, MessageSquare, Workflow,
    Bot, Plug, Settings, AlertCircle,
} from "lucide-react"

export const metadata: Metadata = {
    title: "Help | AFCrashpad CRM",
    description: "How-to guides for using AFCrashpad CRM — pipeline, contacts, email, automations, AI, and integrations.",
}

const SECTIONS = [
    { id: "getting-started", label: "Getting started", Icon: Sparkles },
    { id: "contacts", label: "Contacts", Icon: Users },
    { id: "pipeline", label: "Pipeline & deals", Icon: GitBranch },
    { id: "email", label: "Email", Icon: Mail },
    { id: "sms", label: "SMS", Icon: MessageSquare },
    { id: "automations", label: "Automations", Icon: Workflow },
    { id: "ai", label: "AI features", Icon: Bot },
    { id: "integrations", label: "Integrations", Icon: Plug },
    { id: "settings", label: "Settings & team", Icon: Settings },
    { id: "troubleshooting", label: "Troubleshooting", Icon: AlertCircle },
]

export default function HelpPage() {
    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto max-w-6xl px-4 py-12">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
                >
                    <ArrowLeft className="h-3 w-3" />
                    Back to AFCrashpad CRM
                </Link>

                <h1 className="text-3xl font-semibold tracking-tight mb-2">Help & docs</h1>
                <p className="text-muted-foreground mb-10">
                    Practical guides for the most common things customers ask. Use the sidebar to jump
                    to a topic.
                </p>

                <div className="flex gap-10">
                    {/* Sidebar */}
                    <aside className="hidden lg:block w-56 shrink-0">
                        <div className="sticky top-6 space-y-1">
                            {SECTIONS.map((s) => (
                                <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                >
                                    <s.Icon className="h-3.5 w-3.5" />
                                    {s.label}
                                </a>
                            ))}
                        </div>
                    </aside>

                    {/* Content */}
                    <article className="flex-1 min-w-0 prose prose-sm dark:prose-invert max-w-none prose-headings:tracking-tight prose-h2:text-xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-base prose-h3:mt-8 prose-h3:mb-2 prose-p:leading-relaxed prose-p:my-3 prose-li:my-0.5">

                        {/* ── Getting started ────────────────────────── */}
                        <section id="getting-started" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Getting started</h2>
                            <p>
                                Welcome. AFCrashpad is a multi-purpose CRM for tracking contacts, managing a sales pipeline, sending email + SMS, and automating follow-ups. This page covers the basics; everything else has its own section below.
                            </p>

                            <h3>Your first 10 minutes</h3>
                            <ol>
                                <li><strong>Pick an industry template</strong> in <em>Settings → Workspace → Industry template</em>. This seeds pipeline stages, custom fields, tags, and lead sources tailored to your business. You can change templates later — applying a new one only adds; nothing existing gets overwritten.</li>
                                <li><strong>Load sample data</strong> from <em>Settings → Workspace → Sample data</em>. This drops ~10 sample contacts and deals in your workspace so the dashboard isn&apos;t empty while you explore. Every record is tagged <code>__sample__</code> and you can wipe it all in one click when you&apos;re done.</li>
                                <li><strong>Connect Gmail</strong> from <em>Settings → Integrations</em>. Once connected, sent and received emails automatically log to the matching contact&apos;s timeline.</li>
                                <li><strong>Add a real contact</strong> from <em>Contacts → Add your first contact</em>, or import a CSV via <em>Contacts → Import</em>.</li>
                            </ol>

                            <h3>Keyboard shortcuts</h3>
                            <p>
                                Press <code>?</code> from anywhere to see the full shortcut overlay. The most useful:
                            </p>
                            <ul>
                                <li><code>Cmd K</code> (or <code>Ctrl K</code>) — open the command palette / global search.</li>
                                <li><code>G</code> then <code>D</code> — Dashboard. <code>G P</code> — Pipeline. <code>G C</code> — Contacts. <code>G T</code> — Tasks.</li>
                                <li><code>Esc</code> — close any open dialog or sheet.</li>
                            </ul>
                        </section>

                        {/* ── Contacts ───────────────────────────────── */}
                        <section id="contacts" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Contacts</h2>

                            <h3>Adding contacts</h3>
                            <p>
                                Three ways to add contacts:
                            </p>
                            <ul>
                                <li><strong>Manual</strong>: <em>Contacts → Add contact</em>. Best for one-offs.</li>
                                <li><strong>CSV import</strong>: <em>Contacts → Import</em>. Map your CSV columns to AFCrashpad fields. Duplicates by email are skipped automatically.</li>
                                <li><strong>API / Form embed</strong>: paste the form snippet from <em>Settings → Integrations → Form embed</em> into your website. Submissions become contacts in real time.</li>
                            </ul>

                            <h3>Tags vs. statuses vs. lead sources</h3>
                            <p>
                                These three labels feel similar but do different things:
                            </p>
                            <ul>
                                <li><strong>Status</strong> is a contact&apos;s lifecycle stage — Lead / Active Client / Past Client. Each contact has exactly one status. Configure the list in <em>Settings → Workspace → Custom statuses</em>.</li>
                                <li><strong>Tags</strong> are free-form labels — VIP, Hot Lead, Referral. A contact can have many.</li>
                                <li><strong>Lead source</strong> is where the contact came from — Website, Referral, Google Ads. Tracked once at intake; powers the source-attribution chart on the dashboard.</li>
                            </ul>

                            <h3>Smart lists (saved filters)</h3>
                            <p>
                                Filter contacts by status, tag, search query, and sort, then click <strong>Save filter</strong> to save the combination as a "smart list." Saved lists appear as pills above the table with live counts. The last applied list is remembered across reloads.
                            </p>

                            <h3>Bulk actions</h3>
                            <p>
                                Select multiple contacts (checkbox column) to bulk-update status, add tags, delete, or add to a list. Deletes use a 10-second undo toast — click "Undo" before it dismisses to restore.
                            </p>
                        </section>

                        {/* ── Pipeline ───────────────────────────────── */}
                        <section id="pipeline" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-primary" />Pipeline & deals</h2>

                            <h3>Stages</h3>
                            <p>
                                A pipeline is a sequence of stages a deal moves through. Drag and drop deal cards between stage columns to advance them. Each stage has:
                            </p>
                            <ul>
                                <li><strong>Probability</strong> (0–100%): the chance a deal in this stage will close. Drives the Weighted Forecast on the dashboard.</li>
                                <li><strong>Staleness threshold</strong>: how many days a deal can sit here before being flagged stale. Stale deals show a red pill on the kanban card.</li>
                            </ul>
                            <p>
                                Both are configured in <em>Settings → Workspace → Pipeline configuration</em>.
                            </p>

                            <h3>Smart probabilities</h3>
                            <p>
                                Each stage can use a manual probability or "smart" mode, which derives the probability from your historical conversion rate. Smart needs at least 20 historical deals to be reliable — below that, the dashboard falls back to your manual value automatically. The settings UI shows the sample size so you can see how trustworthy the smart number is.
                            </p>

                            <h3>Status vs. stage</h3>
                            <p>
                                A deal&apos;s <strong>stage</strong> tells you where it is in your funnel (e.g. Negotiation). Its <strong>status</strong> is the lifecycle outcome (Open / Closed Won / Closed Lost / Archived). They&apos;re independent: a deal can be in stage "Qualified" and have status "Closed Lost" if it qualified but the prospect ghosted later. Click the colored Status badge at the top of any deal to change it.
                            </p>
                        </section>

                        {/* ── Email ──────────────────────────────────── */}
                        <section id="email" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Email</h2>

                            <h3>Sending one-off emails</h3>
                            <p>
                                Open any contact, click <strong>Email</strong>, and either compose in your default mail client (mailto:) or open the in-app composer at <em>/communications</em>. The composer supports merge tokens like <code>{"{{first_name}}"}</code>, scheduled sends, snippets, and an inline ✨ AI button that drafts the body for you.
                            </p>

                            <h3>Templates</h3>
                            <p>
                                Save reusable email layouts at <em>Marketing → Email → Templates</em>. Templates support tokens, attachments, and custom subject lines. Pick a template from the composer or use one as the body of an automation step.
                            </p>

                            <h3>Campaigns</h3>
                            <p>
                                A campaign is a one-time send to a list. Build at <em>Marketing → Email → Campaigns → New</em>. You pick a list, a template, a subject, and a send time. Tracking (opens, clicks, unsubscribes) is automatic.
                            </p>

                            <h3>Marketing vs transactional sending</h3>
                            <p>
                                AFCrashpad uses Amazon SES for marketing/bulk sends and your connected Gmail account for personal transactional sends. SES is per-workspace credits — buy them at <em>Settings → Integrations → Amazon SES</em>. Gmail uses your own account, so individual emails come from your address and land in your Sent folder.
                            </p>
                        </section>

                        {/* ── SMS ─────────────────────────────────────── */}
                        <section id="sms" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" />SMS</h2>
                            <p>
                                SMS uses your own Twilio account. To get set up:
                            </p>
                            <ol>
                                <li>Sign up at <a href="https://www.twilio.com" target="_blank" rel="noreferrer">twilio.com</a> and buy a phone number.</li>
                                <li>For US/Canada commercial sends, register an A2P 10DLC campaign through Twilio (required by carriers).</li>
                                <li>In <em>Settings → Integrations → Twilio</em>, paste your Account SID, Auth Token, and From number.</li>
                                <li>Configure the Inbound webhook URL Twilio shows in your number&apos;s "A message comes in" field — AFCrashpad logs replies to the matching contact.</li>
                            </ol>
                            <p>
                                STOP / UNSUBSCRIBE / CANCEL replies automatically opt the contact out. AFCrashpad never sends to contacts marked DND.
                            </p>
                        </section>

                        {/* ── Automations ─────────────────────────────── */}
                        <section id="automations" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" />Automations</h2>

                            <h3>Anatomy of an automation</h3>
                            <p>
                                Every automation has a <strong>trigger</strong> (what fires it — new contact, deal stage entered, time of day, etc.) and a series of <strong>nodes</strong> (what happens — send email, wait, branch on condition, AI classify, etc.). Build at <em>/automations</em> using the visual canvas. Save as Draft to disable while you build, then toggle Active when ready.
                            </p>

                            <h3>Common patterns</h3>
                            <ul>
                                <li><strong>New-lead drip</strong>: trigger = contact_created → wait 1 hour → AI Send Email → wait 2 days → Send Email (template) → end.</li>
                                <li><strong>Stale deal nudge</strong>: trigger = opportunity_stale → AI Send Email asking for an update → wait 5 days → assign to senior rep.</li>
                                <li><strong>Lead-score-based routing</strong>: trigger = contact_created → AI Score → If score &gt; 70 → assign senior rep, else → assign standard rep.</li>
                            </ul>

                            <h3>Debugging</h3>
                            <p>
                                Each automation has a <em>Recent runs</em> panel showing every contact who ran through it, which nodes they hit, and any errors. If a step says "AI key not configured for this workspace," go to <em>Settings → Integrations</em> and add a key for whichever provider that feature is routed to.
                            </p>
                        </section>

                        {/* ── AI ──────────────────────────────────────── */}
                        <section id="ai" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />AI features</h2>

                            <h3>Bring your own keys</h3>
                            <p>
                                AFCrashpad supports three AI providers: Anthropic (Claude), OpenAI (GPT), and Google Gemini. Each is a separate API key you save in <em>Settings → Integrations</em>. You aren&apos;t locked to one — you can save all three and route different features to different providers.
                            </p>

                            <h3>Per-feature routing</h3>
                            <p>
                                In <em>Settings → Integrations → AI routing</em>, every AI feature in the CRM has its own row with provider + model dropdowns. Use a fast cheap model for high-volume tasks (SMS rewrites, classification) and a premium model where quality matters (long-form blog drafts, the in-app assistant). The page also shows usage counts per feature over the last 30 days so you can see where your tokens are going.
                            </p>

                            <h3>Where AI shows up</h3>
                            <ul>
                                <li><strong>AI assistant</strong> — chat icon in the bottom-right corner. Can search contacts, summarize the pipeline, surface stale deals. Also takes safe actions: create a task, add a note, tag a contact, change a contact&apos;s status, move a deal to a stage. Every write is logged to the audit log.</li>
                                <li><strong>✨ Write with AI buttons</strong> — next to email subjects, email bodies, and SMS bodies in the composer. Tap, type a one-line instruction, get a draft.</li>
                                <li><strong>Automation AI nodes</strong> — AI Send Email, AI Classify, AI Score, AI Summarize. Each picks its provider/model from the AI routing settings.</li>
                                <li><strong>Blog generation, HARO replies, deal summaries</strong> — same routing model.</li>
                            </ul>
                        </section>

                        {/* ── Integrations ────────────────────────────── */}
                        <section id="integrations" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><Plug className="h-5 w-5 text-primary" />Integrations</h2>

                            <h3>Webhooks</h3>
                            <p>
                                Webhooks let AFCrashpad POST events to your own systems. Add a receiver URL at <em>Settings → Integrations → Webhooks</em>, pick which events to subscribe to (contact.created, deal.stage_changed, deal.closed_won, etc.), and AFCrashpad will fire signed JSON payloads to your URL when those events happen. Every payload includes an HMAC-SHA256 signature in the <code>X-AFCrashpad-Signature</code> header — verify it before trusting the body.
                            </p>

                            <h3>Slack notifications</h3>
                            <p>
                                For Slack specifically, paste a Slack incoming-webhook URL and pick "Slack message" as the format when creating the webhook. AFCrashpad will format each event as a readable Slack message instead of the raw envelope. No extra middleware needed.
                            </p>

                            <h3>Google Calendar / Apple Calendar</h3>
                            <p>
                                Google Calendar is a per-user OAuth — connect it in <em>Settings → Integrations → Google Calendar</em>. Two-way sync: events in AFCrashpad appear in Google, and vice versa.
                            </p>
                            <p>
                                Apple Calendar uses a one-way subscribe URL because Apple doesn&apos;t expose a write API. Click the <strong>Subscribe</strong> button on the Apple Calendar card to launch Apple Calendar with the feed pre-filled.
                            </p>

                            <h3>REST API</h3>
                            <p>
                                Generate a workspace-scoped key at <em>Settings → Integrations → API keys</em>. Authenticate via <code>x-api-key</code> header against <code>/api/v1/*</code> endpoints. Currently covers contacts, lists, and automation enrollment — full reference in the same settings page.
                            </p>
                        </section>

                        {/* ── Settings ────────────────────────────────── */}
                        <section id="settings" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" />Settings & team</h2>

                            <h3>Workspace name + branding</h3>
                            <p>
                                Each workspace has its own name (shown in the sidebar logo and emails) and branding settings (logo, primary color, font, footer address, website URL, booking link). Configure at <em>Settings → Workspace</em> (workspace name) and <em>Settings → Branding</em> (visuals).
                            </p>

                            <h3>Inviting team members</h3>
                            <p>
                                Go to <em>Settings → Team</em>, click <strong>Invite member</strong>, type their email and pick a role (Owner / Admin / Agent). They get an email invitation with a sign-up link. Each invited user can either create a new password or sign in with Google.
                            </p>

                            <h3>Switching between workspaces</h3>
                            <p>
                                If you belong to multiple workspaces, click the workspace logo at the top of the sidebar to switch. Owners can also create new workspaces from the same dropdown. Settings, contacts, deals, and automations are completely isolated per workspace — switching is essentially logging into a different CRM with the same credentials.
                            </p>
                        </section>

                        {/* ── Troubleshooting ─────────────────────────── */}
                        <section id="troubleshooting" className="scroll-mt-6">
                            <h2 className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-primary" />Troubleshooting</h2>

                            <h3>"AI key not configured" error</h3>
                            <p>
                                Whichever AI feature is throwing this error is routed to a provider whose key isn&apos;t saved in your workspace. Open <em>Settings → Integrations</em>, save a key for the right provider, and try again. Alternatively, change the routing for that feature to a provider you&apos;ve already configured.
                            </p>

                            <h3>Email not sending</h3>
                            <p>
                                Marketing emails: check your SES credit balance at <em>Settings → Integrations → Amazon SES</em>. Verify your sending domain or address is in VERIFIED state. If status is PENDING, finish the DNS records.
                            </p>
                            <p>
                                Personal Gmail emails: reconnect Gmail at <em>Settings → Integrations → Gmail</em> if you see "Send failed: token expired."
                            </p>

                            <h3>SMS not sending</h3>
                            <p>
                                Most often this is A2P 10DLC. US carriers require commercial sender registration — Twilio walks you through it in their console. Until your campaign is approved, sends will silently fail. Check the SMS log at <em>Settings → Integrations → Twilio</em> for the exact Twilio error.
                            </p>

                            <h3>Webhook receiver not getting events</h3>
                            <p>
                                Open <em>Settings → Integrations → Webhooks</em>, find the subscription, and check the failure count + last error. Common causes: receiver returns non-2xx (any 4xx bails immediately, no retry), TLS cert issues, or the receiver URL changed. Click "Send test" to fire a dummy event without waiting for a real one.
                            </p>

                            <h3>Status check</h3>
                            <p>
                                The public status page at <a href="/status">/status</a> runs live health checks of database, auth, email, storage, and background jobs. Refresh for an updated reading. If something here shows down, that&apos;s the cause of widespread issues — wait a minute, then refresh.
                            </p>

                            <h3>Still stuck?</h3>
                            <p>
                                Email <a href="mailto:support@afcrashpad.com">support@afcrashpad.com</a>. Include your workspace name, the action you were trying to take, and any error message. Screenshots help.
                            </p>
                        </section>
                    </article>
                </div>
            </div>
        </div>
    )
}
