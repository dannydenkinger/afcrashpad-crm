import { MarketingSubNav } from "./MarketingSubNav"

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col min-h-0 flex-1">
            <MarketingSubNav />
            <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
    )
}
