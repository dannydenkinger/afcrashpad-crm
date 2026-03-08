export interface BookingEntry {
    id: string
    contactId: string
    name: string
    email: string | null
    phone: string | null
    base: string
    startDate: string
    endDate: string
    value: number
    margin: number
    stage: string
    claimedByName: string | null
    assigneeName: string | null
}

export interface OverlapGroup {
    base: string
    travelers: BookingEntry[]
    overlapStart: string
    overlapEnd: string
    overlapDays: number
    combinedRevenue: number
    arbitrageNote: string
}

export interface BookingsData {
    bookings: BookingEntry[]
    overlaps: OverlapGroup[]
    bases: string[]
}
