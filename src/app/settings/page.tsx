import { auth } from "@/auth"
import { adminDb } from "@/lib/firebase-admin"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ShieldAlert, Users, User, ShieldCheck, BriefcaseBusiness, Link, MapPin, Workflow, ScrollText, Layers, Key, Clock, GitBranch, UserPlus } from "lucide-react"
import { UserManagementTable } from "./users/UserManagementTable"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProfileForm } from "./ProfileForm"
import { IntegrationsTab } from "./IntegrationsTab"
import { BasesManager } from "./bases/BasesManager"
import { LeadSourceManager } from "./leadsources/LeadSourceManager"
import { TagManager } from "./tags/TagManager"
import { StatusManager } from "./system-properties/StatusManager"
import { SpecialAccommodationsManager } from "./system-properties/SpecialAccommodationsManager"
import AutomationsContent from "./automations/AutomationsTab"
import { PipelinePrioritySettings } from "./pipeline/PipelinePrioritySettings"
import { NotificationPreferences } from "./NotificationPreferences"
import { AuditLogViewer } from "./audit/AuditLogViewer"
import { DataExport } from "./data/DataExport"
import { CustomFieldsManager } from "./custom-fields/CustomFieldsManager"
import { BrandingSettings } from "./branding/BrandingSettings"
import { ApiKeyManager } from "./api-keys/ApiKeyManager"
import { ScheduledReports } from "./reports/ScheduledReports"
import { WorkflowBuilder } from "./workflows/WorkflowBuilder"
import { AutoAssignRules } from "./assignment/AutoAssignRules"
import { FollowUpReminders } from "./followups/FollowUpReminders"

export default async function SettingsPage() {
    const session = await auth()

    if (!session?.user?.email) redirect("/")

    const usersSnap = await adminDb.collection('users').where('email', '==', session.user.email).limit(1).get();

    if (usersSnap.empty) redirect("/")

    const dbUser: any = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() };

    // Fetch calendar integration
    const calIntSnap = await adminDb.collection('calendar_integrations').where('userId', '==', dbUser.id).limit(1).get();
    if (!calIntSnap.empty) {
        dbUser.calendarIntegration = calIntSnap.docs[0].data();
    }

    // Ensure they have a calendarFeedId generated
    if (!dbUser.calendarFeedId) {
        const newFeedId = crypto.randomUUID();
        await adminDb.collection('users').doc(dbUser.id).update({
            calendarFeedId: newFeedId
        });
        dbUser.calendarFeedId = newFeedId;
    }

    const { role } = dbUser
    const isOwnerOrAdmin = role === "OWNER" || role === "ADMIN"

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const icsFeedUrl = `${baseUrl}/api/calendar/feed/${dbUser.calendarFeedId}`

    let users: any[] = [];
    let pipelinesList: { id: string; name: string }[] = [];
    if (isOwnerOrAdmin) {
        const [allUsersSnap, pipelinesSnap] = await Promise.all([
            adminDb.collection('users').orderBy('createdAt', 'desc').get(),
            adminDb.collection('pipelines').orderBy('createdAt', 'asc').get(),
        ]);
        users = allUsersSnap.docs.map(doc => {
            const d = doc.data();
            const ts = d.createdAt;
            const createdAt = ts?.toDate ? ts.toDate().toISOString() : (ts instanceof Date ? ts.toISOString() : ts || null);
            return {
                id: doc.id,
                name: d.name || null,
                email: d.email || '',
                role: d.role || 'AGENT',
                createdAt,
            };
        });
        pipelinesList = pipelinesSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name || 'Unnamed Pipeline',
        }));
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8 max-w-full">
                <div className="mb-6 sm:mb-8">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h2>
                    <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Manage your account preferences and application settings.</p>
                </div>

                <Tabs defaultValue="profile" className="w-full">
                    {/* Mobile: horizontal scrollable tabs */}
                    <div className="md:hidden mb-6">
                        <TabsList className="bg-muted/50 p-1 flex overflow-x-auto no-scrollbar scroll-fade-x flex-nowrap h-auto gap-1 w-full">
                            <TabsTrigger value="profile" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                <User className="w-3.5 h-3.5" />
                                My Profile
                            </TabsTrigger>
                            {isOwnerOrAdmin && (
                                <>
                                    <TabsTrigger value="workspace" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <BriefcaseBusiness className="w-3.5 h-3.5" />
                                        Workspace
                                    </TabsTrigger>
                                    <TabsTrigger value="users" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        Users
                                    </TabsTrigger>
                                    <TabsTrigger value="integrations" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <Link className="w-3.5 h-3.5" />
                                        Integrations
                                    </TabsTrigger>
                                    <TabsTrigger value="automations" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <Workflow className="w-3.5 h-3.5" />
                                        Automations
                                    </TabsTrigger>
                                    <TabsTrigger value="custom-fields" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <Layers className="w-3.5 h-3.5" />
                                        Custom Fields
                                    </TabsTrigger>
                                    <TabsTrigger value="api-keys" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <Key className="w-3.5 h-3.5" />
                                        API Keys
                                    </TabsTrigger>
                                    <TabsTrigger value="reports" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <Clock className="w-3.5 h-3.5" />
                                        Reports
                                    </TabsTrigger>
                                    <TabsTrigger value="workflows" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <GitBranch className="w-3.5 h-3.5" />
                                        Workflows
                                    </TabsTrigger>
                                    <TabsTrigger value="assignment" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Assignment
                                    </TabsTrigger>
                                    <TabsTrigger value="audit" className="flex items-center gap-1.5 px-3 shrink-0 text-xs min-h-[44px] touch-manipulation">
                                        <ScrollText className="w-3.5 h-3.5" />
                                        Audit Log
                                    </TabsTrigger>
                                </>
                            )}
                        </TabsList>
                    </div>

                    {/* Desktop: sidebar + content layout */}
                    <div className="md:flex md:gap-8">
                        {/* Desktop sidebar navigation */}
                        <div className="hidden md:block md:w-56 lg:w-64 shrink-0">
                            <nav className="sticky top-6 space-y-6">
                                {/* Personal group */}
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 px-3">Personal</p>
                                    <TabsList className="bg-transparent flex flex-col w-full gap-0.5 h-auto group-data-[orientation=horizontal]/tabs:h-auto p-0">
                                        <TabsTrigger value="profile" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                            <User className="w-4 h-4 shrink-0" />
                                            My Profile
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                {isOwnerOrAdmin && (
                                    <>
                                        {/* Organization group */}
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 px-3">Organization</p>
                                            <TabsList className="bg-transparent flex flex-col w-full gap-0.5 h-auto group-data-[orientation=horizontal]/tabs:h-auto p-0">
                                                <TabsTrigger value="workspace" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <BriefcaseBusiness className="w-4 h-4 shrink-0" />
                                                    Workspace
                                                </TabsTrigger>
                                                <TabsTrigger value="users" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <ShieldCheck className="w-4 h-4 shrink-0" />
                                                    Users
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>

                                        {/* Configuration group */}
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 px-3">Configuration</p>
                                            <TabsList className="bg-transparent flex flex-col w-full gap-0.5 h-auto group-data-[orientation=horizontal]/tabs:h-auto p-0">
                                                <TabsTrigger value="integrations" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <Link className="w-4 h-4 shrink-0" />
                                                    Integrations
                                                </TabsTrigger>
                                                <TabsTrigger value="automations" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <Workflow className="w-4 h-4 shrink-0" />
                                                    Automations
                                                </TabsTrigger>
                                                <TabsTrigger value="custom-fields" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <Layers className="w-4 h-4 shrink-0" />
                                                    Custom Fields
                                                </TabsTrigger>
                                                <TabsTrigger value="reports" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <Clock className="w-4 h-4 shrink-0" />
                                                    Scheduled Reports
                                                </TabsTrigger>
                                                <TabsTrigger value="workflows" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <GitBranch className="w-4 h-4 shrink-0" />
                                                    Workflows
                                                </TabsTrigger>
                                                <TabsTrigger value="assignment" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <UserPlus className="w-4 h-4 shrink-0" />
                                                    Auto-Assignment
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>

                                        {/* Security group */}
                                        <div>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3 px-3">Security</p>
                                            <TabsList className="bg-transparent flex flex-col w-full gap-0.5 h-auto group-data-[orientation=horizontal]/tabs:h-auto p-0">
                                                <TabsTrigger value="api-keys" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <Key className="w-4 h-4 shrink-0" />
                                                    API Keys
                                                </TabsTrigger>
                                                <TabsTrigger value="audit" className="flex items-center gap-2.5 px-3 py-2 w-full justify-start text-sm rounded-md border-0 shadow-none data-[state=active]:bg-muted data-[state=active]:shadow-none data-[state=active]:border-0 dark:data-[state=active]:bg-muted dark:data-[state=active]:border-transparent dark:data-[state=inactive]:bg-transparent dark:data-[state=inactive]:border-transparent hover:bg-muted/50">
                                                    <ScrollText className="w-4 h-4 shrink-0" />
                                                    Audit Log
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>
                                    </>
                                )}
                            </nav>
                        </div>

                        {/* Tab content area */}
                        <div className="flex-1 min-w-0 max-w-4xl">
                            <TabsContent value="profile" className="space-y-6 mt-0">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Personal Information</CardTitle>
                                        <CardDescription>
                                            Update your profile details.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ProfileForm
                                            initialName={dbUser.name}
                                            initialPhone={(dbUser as any).phone || ""}
                                            email={dbUser.email}
                                            role={dbUser.role}
                                            initialImageUrl={(dbUser as any).profileImageUrl || null}
                                        />
                                    </CardContent>
                                </Card>

                                <NotificationPreferences initialPrefs={dbUser.notificationPreferences || null} />

                                <BrandingSettings />
                            </TabsContent>

                            {isOwnerOrAdmin && (
                                <>
                                    <TabsContent value="workspace" className="space-y-8 mt-0">
                                        {/* Section: Company Profile */}
                                        <section>
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle>Company Profile</CardTitle>
                                                    <CardDescription>Configure core details for your CRM instance.</CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="flex flex-col gap-4 max-w-xl">
                                                        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
                                                            <div>
                                                                <div className="font-semibold text-sm">Workspace Name</div>
                                                                <div className="text-sm text-muted-foreground mt-1">AFCrashpad Main CRM</div>
                                                            </div>
                                                            <div className="px-2 py-1 bg-muted rounded text-xs font-mono text-muted-foreground">Read-only</div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </section>

                                        <Separator />

                                        {/* Section: Pipeline Priorities */}
                                        <section>
                                            <PipelinePrioritySettings />
                                        </section>

                                        <Separator />

                                        {/* Section: System Properties */}
                                        <section>
                                            <div className="mb-4">
                                                <h3 className="text-lg font-semibold">System Properties</h3>
                                                <p className="text-sm text-muted-foreground mt-1">Configure dropdown options and selectors used across the CRM.</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <LeadSourceManager />
                                                <TagManager />
                                                <StatusManager />
                                                <SpecialAccommodationsManager />
                                            </div>
                                        </section>

                                        <Separator />

                                        {/* Section: Military Bases */}
                                        <section>
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center gap-2">
                                                        <MapPin className="h-4 w-4" />
                                                        Military Bases & Lodging
                                                    </CardTitle>
                                                    <CardDescription>Configure supported bases and their seasonal lodging rates.</CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <BasesManager />
                                                </CardContent>
                                            </Card>
                                        </section>

                                        <Separator />

                                        {/* Section: Data Management */}
                                        <section>
                                            <DataExport />
                                        </section>
                                    </TabsContent>

                                    <TabsContent value="custom-fields" className="space-y-6 mt-0">
                                        <CustomFieldsManager />
                                    </TabsContent>



                                    <TabsContent value="api-keys" className="space-y-6 mt-0">
                                        <ApiKeyManager />
                                    </TabsContent>

                                    <TabsContent value="integrations" className="space-y-6 mt-0">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Connected Apps</CardTitle>
                                                <CardDescription>Configure external services to power your CRM features.</CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <IntegrationsTab
                                                    isConnected={!!(dbUser as any).calendarIntegration}
                                                    icsFeedUrl={icsFeedUrl}
                                                />
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="automations" className="space-y-6 mt-0">
                                        <AutomationsContent />
                                        <FollowUpReminders pipelines={pipelinesList} />
                                    </TabsContent>

                                    <TabsContent value="reports" className="space-y-6 mt-0">
                                        <ScheduledReports />
                                    </TabsContent>

                                    <TabsContent value="workflows" className="space-y-6 mt-0">
                                        <WorkflowBuilder />
                                    </TabsContent>

                                    <TabsContent value="assignment" className="space-y-6 mt-0">
                                        <AutoAssignRules users={users.map(u => ({ id: u.id, name: u.name || u.email, email: u.email }))} />
                                    </TabsContent>

                                    <TabsContent value="users" className="space-y-6 mt-0">
                                        {role === "OWNER" ? (
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center gap-2">
                                                        <Users className="h-5 w-5" />
                                                        System Users
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Manage system access, assign roles (Owner, Admin, Agent), and remove users.
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <UserManagementTable initialUsers={users} currentUserId={session.user.id || ""} />
                                                </CardContent>
                                            </Card>
                                        ) : (
                                            <Card className="border-amber-500/20 bg-amber-500/10">
                                                <CardHeader>
                                                    <CardTitle className="flex items-center gap-2 text-amber-600">
                                                        <ShieldAlert className="h-5 w-5" />
                                                        Owner Access Required
                                                    </CardTitle>
                                                    <CardDescription className="text-amber-600/80">
                                                        You are an Admin. While you can assign and delete deals, only the system Owner can manage team members and their roles.
                                                    </CardDescription>
                                                </CardHeader>
                                            </Card>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="audit" className="space-y-6 mt-0">
                                        <AuditLogViewer />
                                    </TabsContent>
                                </>
                            )}
                        </div>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
