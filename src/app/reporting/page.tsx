import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, TrendingUp, Search, MapPin, MousePointer2 } from "lucide-react"
import { getReportingData } from "./actions"

export const dynamic = "force-dynamic"

export default async function ReportingPage() {
    const res = await getReportingData();
    const stats = (res.success && res.data) ? res.data : {
        totalProfit: 0,
        avgProfit: 0,
        bookedCount: 0,
        conversionRate: 0,
        topKeywords: [],
        basePerformance: []
    };

    return (
        <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Reporting & Analytics</h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Track your performance across profit margins, conversion rates, and lead sources.</p>
                    </div>
                </div>

                <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="bg-emerald-50/10 border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Closed Profit</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">${stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-muted-foreground">Across {stats.bookedCount} signed deals</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Average Profit / Deal</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${stats.avgProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <p className="text-xs text-muted-foreground">Calculated from closed opportunities</p>
                    </CardContent>
                </Card>

                <Card className="bg-blue-50/10 border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Lead Conversion Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.conversionRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">Leads moved to Booked/Signed stage</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 pt-4">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Lead Volume by Base
                        </CardTitle>
                        <CardDescription>Inquiries and interest levels across different military bases.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.basePerformance.length > 0 ? (
                                stats.basePerformance.map((item, i) => (
                                    <div key={item.base} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{item.base}</span>
                                            <span className="tabular-nums font-bold">{item.count} inquiries</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all"
                                                style={{ width: `${(item.count / stats.basePerformance[0].count) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex h-[300px] items-center justify-center border-2 border-dashed rounded-md bg-muted/10">
                                    <p className="text-sm text-muted-foreground">No base data available yet.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                                    SEO & Referral Keywords
                                </CardTitle>
                                <CardDescription>Top inbound search terms from contacts.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {stats.topKeywords.length > 0 ? (
                                stats.topKeywords.map((item) => (
                                    <div key={item.keyword} className="flex items-center justify-between p-2 rounded-lg border bg-muted/30">
                                        <span className="text-sm font-medium">{item.keyword}</span>
                                        <Badge variant="secondary" className="font-mono">{item.count}</Badge>
                                    </div>
                                ))
                            ) : (
                                <div className="flex h-[300px] items-center justify-center border-2 border-dashed rounded-md bg-muted/10">
                                    <p className="text-sm text-muted-foreground">No keyword data found.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            </div>
        </div>
    )
}

