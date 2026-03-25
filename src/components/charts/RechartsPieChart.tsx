"use client"

import React from "react"
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts"

interface Props {
    data: { name: string; value: number; color: string }[]
    innerRadius?: number
    outerRadius?: number
    paddingAngle?: number
}

export default function RechartsPieChart({
    data,
    innerRadius = 55,
    outerRadius = 70,
    paddingAngle = 4,
}: Props) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="45%"
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    paddingAngle={paddingAngle}
                    dataKey="value"
                    animationDuration={1500}
                    stroke="none"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#18181b', fontSize: '11px' }}
                    itemStyle={{ color: '#18181b' }}
                    formatter={(value: any, name: any) => [`${value} deals`, name]}
                />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconSize={6}
                    formatter={(value) => <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    )
}
