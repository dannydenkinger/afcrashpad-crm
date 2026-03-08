"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, FileText, Search } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const AnalyticsDashboard = dynamic(() => import("./AnalyticsDashboard"), {
    loading: () => <Skeleton className="h-[500px] w-full rounded-xl" />,
    ssr: false,
})
const SEODashboard = dynamic(() => import("./seo/SEODashboard"), {
    loading: () => <Skeleton className="h-[500px] w-full rounded-xl" />,
    ssr: false,
})
const BlogDashboard = dynamic(() => import("./blog/BlogDashboard"), {
    loading: () => <Skeleton className="h-[500px] w-full rounded-xl" />,
    ssr: false,
})

export default function MarketingPage() {
    const [activeTab, setActiveTab] = useState("analytics")

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Marketing & Analytics
                        </h2>
                        <p className="text-sm sm:text-base text-muted-foreground mt-0.5">Monitor traffic, SEO performance, and manage blog content.</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                    <TabsList className="bg-muted/50 p-1 flex overflow-x-auto no-scrollbar scroll-fade-x flex-nowrap sm:flex-wrap h-auto gap-1">
                        <TabsTrigger value="analytics" className="flex items-center gap-2 px-3 sm:px-6 shrink-0 text-xs sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation">
                            <TrendingUp className="w-4 h-4" />
                            Traffic
                        </TabsTrigger>
                        <TabsTrigger value="seo" className="flex items-center gap-2 px-3 sm:px-6 shrink-0 text-xs sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation">
                            <Search className="w-4 h-4" />
                            SEO
                        </TabsTrigger>
                        <TabsTrigger value="blog" className="flex items-center gap-2 px-3 sm:px-6 shrink-0 text-xs sm:text-sm min-h-[44px] sm:min-h-0 touch-manipulation">
                            <FileText className="w-4 h-4" />
                            Blog CMS
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="analytics" className="mt-0">
                        <AnalyticsDashboard />
                    </TabsContent>

                    {activeTab === "seo" && (
                        <TabsContent value="seo" className="mt-0" forceMount>
                            <SEODashboard />
                        </TabsContent>
                    )}

                    <TabsContent value="blog" className="mt-0">
                        <BlogDashboard />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
