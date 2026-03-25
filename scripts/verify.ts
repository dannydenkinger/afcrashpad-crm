import * as admin from "firebase-admin"
import { getFirestore } from "firebase-admin/firestore"
import * as dotenv from "dotenv"
import * as path from "path"
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
    })
}
const db = getFirestore(admin.app(), process.env.FIREBASE_DATABASE_ID || "")

async function verify() {
    const contacts = await db.collection("contacts").get()
    const opps = await db.collection("opportunities").get()
    const tags = await db.collection("tags").get()
    console.log("=== TOTALS ===")
    console.log("Contacts:", contacts.size)
    console.log("Opportunities:", opps.size)
    console.log("Tags:", tags.size)

    let withBase = 0, withDates = 0, withTags = 0
    for (const doc of contacts.docs) {
        const d = doc.data()
        if (d.militaryBase) withBase++
        if (d.stayStartDate) withDates++
        if (d.tags?.length > 0) withTags++
    }
    let oppNotes = 0, oppDates = 0, oppBase = 0
    for (const doc of opps.docs) {
        const d = doc.data()
        if (d.notes) oppNotes++
        if (d.stayStartDate) oppDates++
        if (d.militaryBase) oppBase++
    }
    let contactsWithNotes = 0
    for (const doc of contacts.docs.slice(0, 60)) {
        const n = await doc.ref.collection("notes").get()
        if (n.size > 0) contactsWithNotes++
    }

    console.log("\n=== CONTACTS ===")
    console.log("With military base:", withBase)
    console.log("With dates:", withDates)
    console.log("With tags:", withTags)
    console.log("With notes (first 60 checked):", contactsWithNotes)

    console.log("\n=== OPPORTUNITIES ===")
    console.log("With notes:", oppNotes)
    console.log("With dates:", oppDates)
    console.log("With base:", oppBase)

    console.log("\n=== TAGS ===")
    for (const doc of tags.docs) {
        console.log(`  ${doc.data().name} (${doc.data().color})`)
    }

    // Samples
    for (const doc of opps.docs) {
        const d = doc.data()
        if (d.notes && d.militaryBase && d.stayStartDate) {
            console.log("\n=== SAMPLE OPP ===")
            console.log("Name:", d.name, "| Base:", d.militaryBase)
            console.log("Dates:", d.stayStartDate, "→", d.stayEndDate)
            console.log("Notes:", d.notes?.substring(0, 100))
            break
        }
    }
    for (const doc of contacts.docs) {
        const d = doc.data()
        if (d.tags?.length > 0 && d.militaryBase) {
            console.log("\n=== SAMPLE CONTACT ===")
            console.log("Name:", d.name, "| Email:", d.email)
            console.log("Base:", d.militaryBase, "| Tags:", d.tags.map((t: any) => t.name).join(", "))
            break
        }
    }
}
verify().catch(console.error)
