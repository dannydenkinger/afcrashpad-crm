"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    BarChart3,
    DollarSign,
    LayoutGrid,
    Receipt,
    Send,
    TrendingUp,
    UserCheck,
    Wallet,
} from "lucide-react"

const ITEMS = [
    { href: "/finance", label: "Overview", Icon: LayoutGrid, exact: true },
    { href: "/finance/revenue", label: "Revenue", Icon: TrendingUp },
    { href: "/finance/expenses", label: "Expenses", Icon: Receipt },
    { href: "/finance/commissions", label: "Commissions", Icon: DollarSign },
    { href: "/finance/referrals", label: "Referrals", Icon: UserCheck },
    { href: "/finance/forecasting", label: "Forecasting", Icon: TrendingUp },
    { href: "/finance/payouts", label: "Payouts", Icon: Send },
    { href: "/finance/reports", label: "Reports", Icon: BarChart3 },
]

export function FinanceSubNav() {
    const pathname = usePathname()
    return (
        <nav className="border-b bg-background sticky top-0 z-30 backdrop-blur-md bg-background/85">
            <div className="container mx-auto max-w-6xl px-4">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1.5 pr-3 mr-1 border-r text-xs font-semibold text-muted-foreground py-3 shrink-0">
                        <Wallet className="w-3.5 h-3.5" />
                        Finance
                    </div>
                    {ITEMS.map((item) => {
                        const active = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href)
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors shrink-0 ${
                                    active
                                        ? "text-primary bg-primary/10"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                }`}
                            >
                                <item.Icon className="w-3.5 h-3.5" />
                                {item.label}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
