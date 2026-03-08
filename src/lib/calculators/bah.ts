export interface BAHData {
    mha: string;
    location: string;
    monthlyRate: number;
    yearlyRate: number;
    payGrade: string;
    hasDependents: boolean;
}

const BAH_PAY_GRADES = [
    "E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08", "E09",
    "W01", "W02", "W03", "W04", "W05",
    "O01E", "O02E", "O03E",
    "O01", "O02", "O03", "O04", "O05", "O06", "O07"
];

const BASE_URL = "https://afcrashpad.com/wp-content/API/";

export async function calculateBAH(zip: string, payGrade: string, hasDependents: boolean): Promise<BAHData> {
    // 1. Validate ZIP and Pay Grade
    if (!/^\d{5}$/.test(zip)) throw new Error("Invalid ZIP code");
    if (!BAH_PAY_GRADES.includes(payGrade)) throw new Error("Invalid Pay Grade");

    try {
        // 2. Fetch ZIP mapping to MHA
        const zipMapRes = await fetch(`${BASE_URL}BAHData.json`);
        const zipMapData = await zipMapRes.json();
        const mha = zipMapData.zipCode2DutyStation[zip];

        if (!mha) throw new Error("ZIP code not found in military mapping.");

        // 3. Fetch Rates
        const ratesFile = hasDependents ? "Withdependents.json" : "withoutdependents.json";
        const ratesRes = await fetch(`${BASE_URL}${ratesFile}`);
        const ratesData = await ratesRes.json();

        const headerKey = hasDependents
            ? "2025 BAH Rates - WITH DEPENDENTS"
            : "2025 BAH Rates - WITHOUT DEPENDENTS";

        const rateEntry = ratesData.find((entry: any) => entry[headerKey] === mha);
        if (!rateEntry) throw new Error("BAH rate not found for this location.");

        const locationFull = rateEntry[""] || mha;

        // 4. Extract Rate
        const payGradeIndex = BAH_PAY_GRADES.indexOf(payGrade);
        const rateKey = `__${payGradeIndex + 1}`;
        const monthlyRate = parseFloat(rateEntry[rateKey]);

        if (isNaN(monthlyRate)) throw new Error("BAH rate not available for selected grade.");

        // 5. Get City/State from Zippopotam
        let locationDisplay = locationFull;
        try {
            const geoRes = await fetch(`https://api.zippopotam.us/us/${zip}`);
            if (geoRes.ok) {
                const geoData = await geoRes.json();
                const city = geoData.places[0]['place name'];
                const state = geoData.places[0]['state abbreviation'];
                locationDisplay = `${city}, ${state}`;
            }
        } catch (e) {
            // Geo lookup failed - fall back to MHA location
        }

        return {
            mha: locationFull,
            location: locationDisplay,
            monthlyRate,
            yearlyRate: monthlyRate * 12,
            payGrade,
            hasDependents
        };
    } catch (error: any) {
        throw new Error(`BAH Calculation failed: ${error.message}`);
    }
}
