import type { Snapshot } from "./types"
import { GENERIC_SNAPSHOT } from "./generic"
import { SERVICE_BUSINESS_SNAPSHOT } from "./service-business"
import { REAL_ESTATE_RENTAL_SNAPSHOT } from "./real-estate-rental"
import { REAL_ESTATE_SALES_SNAPSHOT } from "./real-estate-sales"
import { INSURANCE_SNAPSHOT } from "./insurance"
import { FINANCIAL_ADVISOR_SNAPSHOT } from "./financial-advisor"
import { HOME_SERVICES_SNAPSHOT } from "./home-services"
import { MEDICAL_DENTAL_SNAPSHOT } from "./medical-dental"
import { LAW_FIRM_SNAPSHOT } from "./law-firm"
import { AUTO_SALES_SNAPSHOT } from "./auto-sales"
import { FITNESS_SNAPSHOT } from "./fitness"
import { WEDDING_EVENTS_SNAPSHOT } from "./wedding-events"
import { B2B_SAAS_SNAPSHOT } from "./b2b-saas"
import { PHOTOGRAPHY_SNAPSHOT } from "./photography"
import { CONSTRUCTION_SNAPSHOT } from "./construction"

/**
 * Registry of all available snapshots. Add new industry presets here.
 *
 * Order matters — this is what shows up in the workspace-setup picker.
 * Generic stays at the top as the safe default; everything else is
 * grouped roughly by category (services → real estate → health) so
 * related templates cluster together in the picker.
 */
export const SNAPSHOTS: Snapshot[] = [
    GENERIC_SNAPSHOT,
    // Services / professional
    SERVICE_BUSINESS_SNAPSHOT,
    HOME_SERVICES_SNAPSHOT,
    INSURANCE_SNAPSHOT,
    FINANCIAL_ADVISOR_SNAPSHOT,
    LAW_FIRM_SNAPSHOT,
    AUTO_SALES_SNAPSHOT,
    FITNESS_SNAPSHOT,
    WEDDING_EVENTS_SNAPSHOT,
    PHOTOGRAPHY_SNAPSHOT,
    CONSTRUCTION_SNAPSHOT,
    B2B_SAAS_SNAPSHOT,
    // Real estate
    REAL_ESTATE_SALES_SNAPSHOT,
    REAL_ESTATE_RENTAL_SNAPSHOT,
    // Health
    MEDICAL_DENTAL_SNAPSHOT,
]

export const SNAPSHOTS_BY_SLUG: Record<string, Snapshot> = Object.fromEntries(
    SNAPSHOTS.map((s) => [s.slug, s]),
)

export function getSnapshot(slug: string): Snapshot | null {
    return SNAPSHOTS_BY_SLUG[slug] ?? null
}

export type { Snapshot } from "./types"
