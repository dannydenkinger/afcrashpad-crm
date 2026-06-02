import { FinanceSubNav } from "./FinanceSubNav"

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col min-h-0 flex-1">
            <FinanceSubNav />
            <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        </div>
    )
}
