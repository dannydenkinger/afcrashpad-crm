/**
 * Utility for fetching lodging and M&IE rates from the GSA Per Diem API.
 */

export const GSA_API_KEY = 'ARKignynx4qyomxRPweWnSEui7l5JHlXCa3Q3YxS';

export interface GsaMonth {
    number: string;
    value: string;
}

export interface GsaLodgingRate {
    city: string;
    county: string;
    state: string;
    zip?: string;
    months: {
        month: GsaMonth[];
    };
    meals?: number;
}

export interface GsaMieRate {
    total: number;
    breakfast: number;
    lunch: number;
    dinner: number;
    incidental: number;
    FirstLastDay: number;
    state: string;
    location?: string;
}

export interface OffBaseLodgingResult {
    lodgingData: GsaLodgingRate[];
    mealsData: GsaMieRate[];
}

/**
 * Fetch lodging rates by ZIP code
 */
export async function fetchLodgingByZip(zip: string, year: number): Promise<GsaLodgingRate> {
    const url = `https://api.gsa.gov/travel/perdiem/v2/rates/zip/${zip}/year/${year}?api_key=${GSA_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GSA API Error: ${response.status}`);
    const data = await response.json();

    if (!data?.rates?.[0]?.rate?.[0]) {
        throw new Error('No lodging data found for this ZIP code.');
    }

    return data.rates[0].rate[0];
}

/**
 * Fetch lodging rates by City/State
 */
export async function fetchLodgingByStateCity(state: string, year: number, city?: string): Promise<GsaLodgingRate[]> {
    let url = "";
    if (city) {
        url = `https://api.gsa.gov/travel/perdiem/v2/rates/city/${encodeURIComponent(city)}/state/${state}/year/${year}?api_key=${GSA_API_KEY}`;
    } else {
        url = `https://api.gsa.gov/travel/perdiem/v2/rates/conus/lodging/${year}?api_key=${GSA_API_KEY}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`GSA API Error: ${response.status}`);
    const data = await response.json();

    let results: GsaLodgingRate[] = [];

    if (city) {
        if (data?.rates?.[0]?.rate?.[0]) {
            results = [data.rates[0].rate[0]];
        }
    } else {
        // Filter by state if no city provided (the conus endpoint returns all)
        const allRates = Array.isArray(data) ? data : [];
        results = allRates.filter((item: any) => {
            const st = item.State || item.state;
            return st && st.toUpperCase() === state.toUpperCase();
        });
    }

    if (results.length === 0) {
        throw new Error('No lodging data found for the specified location.');
    }

    // Sort: Standard Rate first, then alphabetically by city
    return results.sort((a, b) => {
        const aCity = ((a as any).City || (a as any).city || '').trim().toLowerCase();
        const bCity = ((b as any).City || (b as any).city || '').trim().toLowerCase();

        const aIsStandard = aCity === 'standard rate' || aCity === '';
        const bIsStandard = bCity === 'standard rate' || bCity === '';

        if (aIsStandard) return -1;
        if (bIsStandard) return 1;
        return aCity.localeCompare(bCity);
    });
}

/**
 * Fetch M&IE (Meals & Incidental Expenses) rates
 */
export async function fetchMieRates(year: number): Promise<GsaMieRate[]> {
    const url = `https://api.gsa.gov/travel/perdiem/v2/rates/conus/mie/${year}?api_key=${GSA_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GSA API Error: ${response.status}`);
    return await response.json();
}
