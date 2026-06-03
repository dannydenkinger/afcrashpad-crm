const GSA_API_KEY = "ARKignynx4qyomxRPweWnSEui7l5JHlXCa3Q3YxS"; // Provided in original source
const BASE_URL = "https://api.gsa.gov/travel/perdiem/v2";

export interface TDYRate {
    city: string;
    county: string;
    lodgingRates: Record<string, number>; // Month -> Rate
    mieTotal: number;
    mieBreakdown: {
        breakfast: number;
        lunch: number;
        dinner: number;
        incidental: number;
        firstLastDay: number;
    };
    // Trip specific totals (if dates provided)
    tripTotals?: {
        totalDays: number;
        totalLodging: number;
        totalMie: number;
        grandTotal: number;
        dailyAverage: number;
    };
}

export async function calculateTDY(params: {
    zip?: string;
    city?: string;
    state?: string;
    year: number;
}): Promise<TDYRate[]> {
    const { zip, city, state, year } = params;
    let lodgingUrl = "";

    if (zip) {
        lodgingUrl = `${BASE_URL}/rates/zip/${zip}/year/${year}?api_key=${GSA_API_KEY}`;
    } else if (city && state) {
        lodgingUrl = `${BASE_URL}/rates/city/${encodeURIComponent(city)}/state/${state}/year/${year}?api_key=${GSA_API_KEY}`;
    } else if (state) {
        lodgingUrl = `${BASE_URL}/rates/conus/lodging/${year}?api_key=${GSA_API_KEY}`;
    } else {
        throw new Error("Insufficient search parameters for TDY calculation.");
    }

    const resLodging = await fetch(lodgingUrl);
    if (!resLodging.ok) throw new Error(`GSA API Error: ${resLodging.status}`);
    const dataLodging = await resLodging.json();

    let rates: any[] = [];
    if (zip || (city && state)) {
        rates = dataLodging.rates[0]?.rate || [];
    } else {
        // CONUS wide for a state
        rates = Array.isArray(dataLodging) ? dataLodging.filter((item: any) =>
            (item.State || item.state)?.toUpperCase() === state?.toUpperCase()
        ) : [];
    }

    if (rates.length === 0) throw new Error("No lodging data found.");

    // Fetch M&IE data
    const mieUrl = `${BASE_URL}/rates/conus/mie/${year}?api_key=${GSA_API_KEY}`;
    const resMie = await fetch(mieUrl);
    const mieData = await resMie.json();

    return rates.map(rate => {
        const cityName = rate.City || rate.city || "Standard Rate";
        const countyName = rate.County || rate.county || "N/A";

        // Process lodging months
        const lodgingRates: Record<string, number> = {};
        const months = rate.months?.month || [];
        if (months.length > 0) {
            months.forEach((m: any) => {
                lodgingRates[m.number] = parseFloat(m.value);
            });
        } else {
            // Fallback if data structure is different (conus vs specific)
            const monthKeys = ["oct", "nov", "dec", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep"];
            monthKeys.forEach((m, i) => {
                const val = rate[m] || rate[m.toUpperCase()];
                if (val) lodgingRates[i + 1] = parseFloat(val);
            });
        }

        // Find matching M&IE
        const mealRate = rate.Meals || rate.meals || 86; // Default standard
        const matchingMeal = mieData.find((m: any) => Number(m.total) === Number(mealRate)) || mieData[0];

        return {
            city: cityName,
            county: countyName,
            lodgingRates,
            mieTotal: parseFloat(matchingMeal.total),
            mieBreakdown: {
                breakfast: parseFloat(matchingMeal.breakfast),
                lunch: parseFloat(matchingMeal.lunch),
                dinner: parseFloat(matchingMeal.dinner),
                incidental: parseFloat(matchingMeal.incidental),
                firstLastDay: parseFloat(matchingMeal.FirstLastDay)
            }
        };
    });
}

/**
 * Calculates total trip costs based on a range of dates and fetched GSA rates.
 */
export function calculateTripCosts(rate: TDYRate, startDateStr: string, endDateStr: string) {
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const [ey, em, ed] = endDateStr.split('-').map(Number);

    // Parse to local noon to avoid DST/TZ shifts
    const start = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;

    let totalLodging = 0;
    let totalMie = 0;
    let totalDays = 0;

    const curr = new Date(start);
    while (curr <= end) {
        totalDays++;
        const month = (curr.getMonth() + 1).toString();
        const lodgingRate = rate.lodgingRates[month] || rate.lodgingRates["1"] || 0;

        totalLodging += lodgingRate;

        // M&IE logic: First and last day are 75%
        if (totalDays === 1 || curr.getTime() === end.getTime()) {
            totalMie += rate.mieBreakdown.firstLastDay;
        } else {
            totalMie += rate.mieTotal;
        }

        curr.setDate(curr.getDate() + 1);
        curr.setHours(12, 0, 0, 0); // Re-anchor to noon
    }

    const grandTotal = totalLodging + totalMie;

    return {
        totalDays,
        totalLodging,
        totalMie,
        grandTotal,
        dailyAverage: grandTotal / totalDays
    };
}
