import { auth } from "@/auth"
import { adminDb } from "@/lib/firebase-admin"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ShieldAlert, Users, User, ShieldCheck, BriefcaseBusiness, Construction, Link, MapPin, Workflow } from "lucide-react"
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
    if (isOwnerOrAdmin) {
        const usersSnap = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
        users = usersSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : doc.data().createdAt
        }));
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Manage your account preferences and application settings.</p>
                    </div>
                </div>

                <Tabs defaultValue="profile" className="w-full space-y-6">
                    <TabsList className="bg-muted/50 p-1 flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="profile" className="flex items-center gap-2 px-6">
                        <User className="w-4 h-4" />
                        My Profile
                    </TabsTrigger>
                    {isOwnerOrAdmin && (
                        <>
                            <TabsTrigger value="workspace" className="flex items-center gap-2 px-6">
                                <BriefcaseBusiness className="w-4 h-4" />
                                Workspace Options
                            </TabsTrigger>
                            <TabsTrigger value="integrations" className="flex items-center gap-2 px-6">
                                <Link className="w-4 h-4" />
                                Integrations
                            </TabsTrigger>
                            <TabsTrigger value="users" className="flex items-center gap-2 px-6">
                                <ShieldCheck className="w-4 h-4" />
                                User Management
                            </TabsTrigger>
                            <TabsTrigger value="automations" className="flex items-center gap-2 px-6">
                                <Workflow className="w-4 h-4" />
                                Automations
                            </TabsTrigger>
                        </>
                    )}
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
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
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {isOwnerOrAdmin && (
                    <>
                        <TabsContent value="workspace" className="space-y-6">
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

                            <PipelinePrioritySettings />

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4">System Properties</h3>
                                    <p className="text-sm text-muted-foreground mb-4">Configure dropdown options and selectors used across the CRM.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <LeadSourceManager />
                                    <TagManager />
                                    <StatusManager />
                                    <SpecialAccommodationsManager />
                                </div>
                            </div>

                            <div className="pt-6">
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
                            </div>
                        </TabsContent>

                        <TabsContent value="integrations" className="space-y-6">
                            <Card className="max-w-2xl">
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

                        <TabsContent value="automations" className="space-y-6">
                            <AutomationsContent />
                        </TabsContent>

                        <TabsContent value="users" className="space-y-6">
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


                    </>
                )}
            </Tabs>
            </div>
        </div>
    )
}
