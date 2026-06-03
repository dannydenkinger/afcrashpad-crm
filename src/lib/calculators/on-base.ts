
export interface LodgingPeriod {
    start: string; // MM-DD
    end: string;   // MM-DD
    rate: number;
}

export const lodgingData: Record<string, LodgingPeriod[]> = {
    "Air Force Academy, CO": [
        { start: "10-01", end: "05-31", rate: 104 },
        { start: "06-01", end: "08-31", rate: 144 },
        { start: "09-01", end: "09-30", rate: 104 }
    ],
    "Altus AFB, OK": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Aviano AB, IT": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Barksdale AFB, LA": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Beale AFB, CA": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Buckley AFB, CO": [
        { start: "10-01", end: "10-31", rate: 171 },
        { start: "11-01", end: "03-31", rate: 144 },
        { start: "04-01", end: "09-30", rate: 171 }
    ],
    "Cannon AFB, NM": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Columbus AFB, MS": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Davis-Monthan AFB, AZ": [
        { start: "10-01", end: "12-31", rate: 104 },
        { start: "01-01", end: "03-31", rate: 144 },
        { start: "04-01", end: "09-30", rate: 104 }
    ],
    "Dobbins ARB, GA": [
        { start: "10-01", end: "09-30", rate: 104 }
    ],
    "Dover AFB, DE": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Duke Field, FL": [
        { start: "10-01", end: "10-31", rate: 144 },
        { start: "11-01", end: "02-29", rate: 99 },
        { start: "03-01", end: "05-31", rate: 164 },
        { start: "06-01", end: "07-31", rate: 185 },
        { start: "08-01", end: "09-30", rate: 144 }
    ],
    "Dyess AFB, TX": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Edwards AFB, CA": [
        { start: "10-01", end: "09-30", rate: 164 }
    ],
    "Eglin AFB, FL": [
        { start: "10-01", end: "10-31", rate: 144 },
        { start: "11-01", end: "02-29", rate: 99 },
        { start: "03-01", end: "05-31", rate: 164 },
        { start: "06-01", end: "07-31", rate: 185 },
        { start: "08-01", end: "09-30", rate: 144 }
    ],
    "Eielson AFB, AK": [
        { start: "10-01", end: "05-15", rate: 164 },
        { start: "05-16", end: "09-30", rate: 185 }
    ],
    "Ellsworth AFB, SD": [
        { start: "10-01", end: "05-31", rate: 99 },
        { start: "06-01", end: "08-31", rate: 144 },
        { start: "09-01", end: "09-30", rate: 99 }
    ],
    "Fairchild AFB, WA": [
        { start: "10-01", end: "09-30", rate: 104 }
    ],
    "Goodfellow AFB, TX": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Grissom ARB, IN": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Gunter Annex, AL": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Hill AFB, UT": [
        { start: "10-01", end: "09-30", rate: 96 }
    ],
    "Holloman AFB, NM": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Hurlburt Field, FL": [
        { start: "10-01", end: "10-31", rate: 144 },
        { start: "11-01", end: "02-29", rate: 99 },
        { start: "03-01", end: "05-31", rate: 164 },
        { start: "06-01", end: "07-31", rate: 185 },
        { start: "08-01", end: "09-30", rate: 144 }
    ],
    "Incirlik AB, TR": [
        { start: "10-01", end: "09-30", rate: 144 }
    ],
    "JB Andrews, MD": [
        { start: "10-01", end: "10-31", rate: 185 },
        { start: "11-01", end: "02-29", rate: 164 },
        { start: "03-01", end: "06-30", rate: 185 },
        { start: "07-01", end: "08-31", rate: 155 },
        { start: "09-01", end: "09-30", rate: 185 }
    ],
    "JB Charleston, SC": [
        { start: "10-01", end: "10-31", rate: 127 },
        { start: "11-01", end: "02-29", rate: 119 },
        { start: "06-01", end: "09-30", rate: 127 },
        { start: "03-01", end: "05-31", rate: 127 }
    ],
    "JB Elmendorf-Richardson, AK": [
        { start: "10-01", end: "10-31", rate: 171 },
        { start: "05-01", end: "08-31", rate: 185 },
        { start: "09-01", end: "09-30", rate: 171 }
    ],
    "JB Langley-Eustis, VA": [
        { start: "10-01", end: "09-30", rate: 96 }
    ],
    "JB MDL (Lakehurst Naval AWC), NJ": [
        { start: "10-01", end: "06-30", rate: 144 },
        { start: "07-01", end: "08-31", rate: 171 },
        { start: "09-01", end: "09-30", rate: 144 }
    ],
    "JB MDL (McGuire-Dix), NJ": [
        { start: "10-01", end: "09-30", rate: 104 }
    ],
    "JB San Antonio (Lackland), TX": [
        { start: "10-01", end: "05-31", rate: 109 },
        { start: "06-01", end: "07-31", rate: 115 },
        { start: "08-01", end: "08-31", rate: 110 },
        { start: "09-01", end: "09-30", rate: 109 }
    ],
    "JB San Antonio (Randolph), TX": [
        { start: "10-01", end: "09-30", rate: 96 }
    ],
    "Kadena AB, JP": [
        { start: "10-01", end: "06-30", rate: 164 },
        { start: "07-01", end: "08-31", rate: 185 },
        { start: "09-01", end: "09-30", rate: 164 }
    ],
    "Keesler AFB, MS": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Kirtland AFB, NM": [
        { start: "10-01", end: "09-30", rate: 124 }
    ],
    "Kunsan AB, KR": [
        { start: "10-01", end: "09-30", rate: 69 }
    ],
    "Lajes Field, PT": [
        { start: "10-01", end: "09-30", rate: 95 }
    ],
    "Laughlin AFB, TX": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Little Rock AFB, AR": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Luke AFB, AZ": [
        { start: "10-01", end: "01-31", rate: 139 },
        { start: "02-01", end: "03-31", rate: 171 },
        { start: "04-01", end: "05-31", rate: 139 },
        { start: "06-01", end: "08-31", rate: 99 },
        { start: "09-01", end: "09-30", rate: 139 }
    ],
    "MacDill AFB, FL": [
        { start: "10-01", end: "12-31", rate: 123 },
        { start: "05-01", end: "09-30", rate: 123 },
        { start: "01-01", end: "01-31", rate: 124 },
        { start: "02-01", end: "04-30", rate: 124 }
    ],
    "Malmstrom AFB, MT": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "March ARB, CA": [
        { start: "10-01", end: "04-30", rate: 164 },
        { start: "05-01", end: "09-30", rate: 124 }
    ],
    "Maxwell AFB, AL": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "McConnell AFB, KS": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Minneapolis-Saint Paul ARS, MN": [
        { start: "10-01", end: "09-30", rate: 124 }
    ],
    "Minot AFB, ND": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Misawa AB, JP": [
        { start: "10-01", end: "09-30", rate: 104 }
    ],
    "Moody AFB, GA": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Morón AB, SP": [
        { start: "10-01", end: "09-30", rate: 124 }
    ],
    "Mountain Home AFB, ID": [
        { start: "10-01", end: "11-30", rate: 164 },
        { start: "12-01", end: "03-31", rate: 185 },
        { start: "04-01", end: "05-31", rate: 164 },
        { start: "06-01", end: "09-30", rate: 185 }
    ],
    "Nellis AFB, NV": [
        { start: "10-01", end: "12-31", rate: 104 },
        { start: "04-01", end: "09-30", rate: 104 },
        { start: "01-01", end: "03-31", rate: 144 }
    ],
    "Niagara Falls ARS, NY": [
        { start: "10-01", end: "05-31", rate: 99 },
        { start: "06-01", end: "08-31", rate: 124 },
        { start: "09-01", end: "09-30", rate: 99 }
    ],
    "Offutt AFB, NE": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Osan AB, KR": [
        { start: "10-01", end: "09-30", rate: 65 }
    ],
    "Patrick AFB, FL": [
        { start: "10-01", end: "01-31", rate: 119 },
        { start: "02-01", end: "03-31", rate: 164 },
        { start: "04-01", end: "09-30", rate: 119 }
    ],
    "Peterson AFB, CO": [
        { start: "10-01", end: "05-31", rate: 104 },
        { start: "06-01", end: "08-31", rate: 144 },
        { start: "09-01", end: "09-30", rate: 104 }
    ],
    "Pensacola NAS, FL": [
        { start: "08-01", end: "02-29", rate: 120 },
        { start: "03-01", end: "05-31", rate: 149 },
        { start: "06-01", end: "07-31", rate: 190 }
    ],
    "RAF Alconbury (Molesworth), UK": [
        { start: "10-01", end: "09-30", rate: 185 }
    ],
    "RAF Croughton, UK": [
        { start: "10-01", end: "09-30", rate: 185 }
    ],
    "RAF Lakenheath, UK": [
        { start: "10-01", end: "09-30", rate: 185 }
    ],
    "RAF Mildenhall, UK": [
        { start: "10-01", end: "09-30", rate: 185 }
    ],
    "Ramstein AB, DE": [
        { start: "10-01", end: "09-30", rate: 164 }
    ],
    "Robins AFB, GA": [
        { start: "10-01", end: "09-30", rate: 96 }
    ],
    "Scott AFB, IL": [
        { start: "10-01", end: "09-30", rate: 124 }
    ],
    "Seymour Johnson AFB, NC": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Shaw AFB, SC": [
        { start: "10-01", end: "09-30", rate: 96 }
    ],
    "Sheppard AFB, TX": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Spangdahlem AB, DE": [
        { start: "10-01", end: "09-30", rate: 164 }
    ],
    "Travis AFB, CA": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Tyndall AFB, FL": [
        { start: "10-01", end: "02-29", rate: 99 },
        { start: "03-01", end: "05-31", rate: 124 },
        { start: "06-01", end: "07-31", rate: 164 },
        { start: "08-01", end: "09-30", rate: 99 }
    ],
    "Vandenberg AFB, CA": [
        { start: "10-01", end: "05-31", rate: 164 },
        { start: "06-01", end: "08-31", rate: 185 },
        { start: "09-01", end: "09-30", rate: 164 }
    ],
    "Westover ARB, MA": [
        { start: "10-01", end: "10-31", rate: 104 },
        { start: "11-01", end: "03-31", rate: 104 },
        { start: "04-01", end: "09-30", rate: 104 }
    ],
    "Whiteman AFB, MO": [
        { start: "10-01", end: "09-30", rate: 99 }
    ],
    "Wright-Patterson AFB, OH": [
        { start: "10-01", end: "09-30", rate: 99 }
    ]
};

export interface CalculationResult {
    totalCost: number;
    totalNights: number;
    breakdown: Array<{ date: string; rate: number }>;
}

export function calculateOnBaseLodging(base: string, startDateStr: string, endDateStr: string): CalculationResult {
    // Parse YYYY-MM-DD as local date noon to defeat timezone/DST shifts
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const [ey, em, ed] = endDateStr.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);

    const periods = lodgingData[base];

    if (!periods || isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { totalCost: 0, totalNights: 0, breakdown: [] };
    }

    let totalCost = 0;
    let totalNights = 0;
    const breakdown: Array<{ date: string; rate: number }> = [];
    const current = new Date(start);

    while (current < end) {
        // Format current back to string safely
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');

        const rate = getRateForDate(periods, current);
        breakdown.push({
            date: `${yyyy}-${mm}-${dd}`,
            rate
        });
        totalCost += rate;
        totalNights++;

        current.setDate(current.getDate() + 1);
        current.setHours(12, 0, 0, 0); // Re-anchor to noon
    }

    return { totalCost, totalNights, breakdown };
}

function getRateForDate(periods: LodgingPeriod[], date: Date): number {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const period = periods.find(p => {
        const [startMonth, startDay] = p.start.split('-').map(Number);
        const [endMonth, endDay] = p.end.split('-').map(Number);

        if (startMonth <= endMonth) {
            return (month > startMonth || (month === startMonth && day >= startDay)) &&
                (month < endMonth || (month === endMonth && day <= endDay));
        } else {
            // Wraps around year end
            return (month > startMonth || (month === startMonth && day >= startDay)) ||
                (month < endMonth || (month === endMonth && day <= endDay));
        }
    });

    return period?.rate || 0;
}
export const baseToZip: Record<string, string> = {
    "Air Force Academy, CO": "80840",
    "Altus AFB, OK": "73523",
    "Aviano AB, IT": "",
    "Barksdale AFB, LA": "71110",
    "Beale AFB, CA": "95903",
    "Buckley AFB, CO": "80011",
    "Cannon AFB, NM": "88103",
    "Columbus AFB, MS": "39710",
    "Davis-Monthan AFB, AZ": "85707",
    "Dobbins ARB, GA": "30069",
    "Dover AFB, DE": "19902",
    "Duke Field, FL": "32542",
    "Dyess AFB, TX": "79607",
    "Edwards AFB, CA": "93524",
    "Eglin AFB, FL": "32542",
    "Eielson AFB, AK": "99702",
    "Ellsworth AFB, SD": "57706",
    "Fairchild AFB, WA": "99011",
    "Goodfellow AFB, TX": "76908",
    "Grissom ARB, IN": "46971",
    "Gunter Annex, AL": "36114",
    "Hill AFB, UT": "84056",
    "Holloman AFB, NM": "88330",
    "Hurlburt Field, FL": "32544",
    "Incirlik AB, TR": "",
    "JB Andrews, MD": "20762",
    "JB Charleston, SC": "29404",
    "JB Elmendorf-Richardson, AK": "99506",
    "JB Langley-Eustis, VA": "23665",
    "JB MDL (Lakehurst Naval AWC), NJ": "08733",
    "JB MDL (McGuire-Dix), NJ": "08641",
    "JB San Antonio (Lackland), TX": "78236",
    "JB San Antonio (Randolph), TX": "78150",
    "Kadena AB, JP": "",
    "Keesler AFB, MS": "39534",
    "Kirtland AFB, NM": "87117",
    "Kunsan AB, KR": "",
    "Lajes Field, PT": "",
    "Laughlin AFB, TX": "78843",
    "Little Rock AFB, AR": "72099",
    "Luke AFB, AZ": "85309",
    "MacDill AFB, FL": "33621",
    "Malmstrom AFB, MT": "59402",
    "March ARB, CA": "92518",
    "Maxwell AFB, AL": "36112",
    "McConnell AFB, KS": "67221",
    "Minneapolis-Saint Paul ARS, MN": "55450",
    "Minot AFB, ND": "58705",
    "Misawa AB, JP": "",
    "Moody AFB, GA": "31699",
    "Morón AB, SP": "",
    "Mountain Home AFB, ID": "83648",
    "Nellis AFB, NV": "89191",
    "Niagara Falls ARS, NY": "14304",
    "Offutt AFB, NE": "68113",
    "Osan AB, KR": "",
    "Patrick AFB, FL": "32925",
    "Peterson AFB, CO": "80914",
    "Pensacola NAS, FL": "32508",
    "RAF Alconbury (Molesworth), UK": "",
    "RAF Croughton, UK": "",
    "RAF Lakenheath, UK": "",
    "RAF Mildenhall, UK": "",
    "Ramstein AB, DE": "",
    "Robins AFB, GA": "31098",
    "Scott AFB, IL": "62225",
    "Seymour Johnson AFB, NC": "27531",
    "Shaw AFB, SC": "29152",
    "Sheppard AFB, TX": "76311",
    "Spangdahlem AB, DE": "",
    "Travis AFB, CA": "94535",
    "Tyndall AFB, FL": "32403",
    "Vandenberg AFB, CA": "93437",
    "Westover ARB, MA": "01022",
    "Whiteman AFB, MO": "65305",
    "Wright-Patterson AFB, OH": "45433"
};
