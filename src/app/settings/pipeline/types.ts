export type PipelinePrioritySettings = {
    urgentDays: number
    soonDays: number
}

/**
 * Sample-size threshold below which a "smart" probability is unreliable.
 * Below this, the dashboard's weighted forecast falls back to the manual %.
 * Exposed in the UI so the warning text matches the actual cutoff.
 */
export const SMART_PROBABILITY_MIN_SAMPLES = 20
