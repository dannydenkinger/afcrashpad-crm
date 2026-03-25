"use client"

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts"

interface SparklineProps {
    variant: "sparkline"
    data: any[]
    dataKey: string
    gradientId: string
    strokeColor: string
}

interface FullProps {
    variant: "full"
    data: any[]
    dataKey: string
    gradientId: string
    strokeColor: string
    gradientStopColor: string
    xAxisInterval?: number
    yAxisFormatter?: (value: number) => string
    tooltipFormatter?: (value: any) => [string, string]
}

type Props = SparklineProps | FullProps

export default function RechartsAreaChart(props: Props) {
    if (props.variant === "sparkline") {
        return (
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={props.data}>
                    <defs>
                        <linearGradient id={props.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={props.strokeColor} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={props.strokeColor} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey={props.dataKey}
                        stroke={props.strokeColor}
                        strokeWidth={1.5}
                        fill={`url(#${props.gradientId})`}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        )
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={props.data} margin={{ left: -10, right: 5 }}>
                <defs>
                    <linearGradient id={props.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={props.gradientStopColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={props.gradientStopColor} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.08} />
                <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#666' }}
                    dy={10}
                    interval={props.xAxisInterval ?? 1}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#666' }}
                    width={45}
                    tickFormatter={props.yAxisFormatter}
                />
                <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    itemStyle={{ color: props.strokeColor, padding: '0' }}
                    formatter={props.tooltipFormatter}
                />
                <Area
                    type="monotone"
                    dataKey={props.dataKey}
                    stroke={props.strokeColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#${props.gradientId})`}
                    animationDuration={1500}
                />
            </AreaChart>
        </ResponsiveContainer>
    )
}
