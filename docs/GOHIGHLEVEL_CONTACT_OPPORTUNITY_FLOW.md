# GoHighLevel Contact vs Opportunity Flow (Reference for Vesta CRM)

This doc summarizes how **GoHighLevel (GHL)** structures contacts and opportunities so you can align Vesta CRM with the same mental model.

---

## 1. Core relationship (GHL)

- **Contacts** = people in your system (name, email, phone, etc.).
- **Opportunities** = potential deals/sales **linked to** a contact and placed in a **pipeline** with **stages** and **status**.

> *"A contact becomes an opportunity when there's a prospect of a sale or deal associated with that contact and it is added to a sales pipeline."*

So: **Contact** (person) → can have one or more **Opportunities** (deals) in one or more pipelines.

---

## 2. Opportunity = contact + pipeline + stage + value + owner

Each opportunity in GHL bundles:

| Concept | GHL | Vesta CRM |
|--------|-----|-----------------|
| **Contact** | Linked contact (person) | `contactId` on opportunity; contact doc has name, email, phone, etc. |
| **Pipeline** | Which sales process | Pipelines (e.g. "Traveler Placement") with configurable stages |
| **Stage** | Position in that pipeline | `pipelineStageId` → stage name (e.g. "New Lead", "Lease Sent") |
| **Deal value** | Estimated value | `opportunityValue` / `value` |
| **Owner** | Assigned rep | `assigneeId` / assignee |
| **Status** | Open / Won / Lost / Abandoned | Can map to stages or add explicit `status` field |

Your CRM already has this: one **contact** doc, many **opportunity** docs with `contactId`, pipeline/stage, value, assignee.

---

## 3. One contact, multiple opportunities (GHL)

- **Different pipelines:** One contact can have opportunities in multiple pipelines (e.g. "Traveler" and "Marketing").
- **Same pipeline:** GHL has a setting *"Allow Multiple Opportunities per Contact"* (per pipeline). When ON, the same contact can have multiple opportunities in the **same** pipeline (renewals, upsells, multi-location, etc.).

**Vesta:** Your data model already supports this: each opportunity has `contactId` and `pipelineStageId`. You can have multiple opportunity docs with the same `contactId` in the same or different pipelines. No schema change needed; it’s the same as GHL when “multiple per contact” is allowed.

---

## 4. Where things live (GHL)

- **Contact profile:** Contact info, and a section listing **all opportunities** for that contact (across pipelines).
- **Opportunity card (in pipeline):** Deal-specific fields (value, stage, status) plus **linked contact** and **shared context** (notes, tasks, communications).
- **Notes/tasks:** In GHL, notes on an opportunity also show on the contact so there are no silos.

**Vesta alignment:**

- **Contacts page** = contact-centric view; you can show “Opportunities” for that contact (you already have opportunity data via `contactId`).
- **Pipeline page** = opportunity-centric view; each card shows contact (name, email, phone) and deal (stage, value, dates). You already do this by loading contact for each opportunity in `getPipelines`.
- **Notes:** You can keep “notes on opportunity” and “notes on contact” and, if you want GHL-like behavior, surface opportunity notes on the contact profile (and vice versa) so it feels like one timeline.

---

## 5. Pipeline and stages (GHL)

- **Pipelines** = sequences of **stages** (e.g. New Lead → Contacted → Proposal → Negotiation → Closed).
- **Stages** are ordered; opportunities move from stage to stage (e.g. drag-and-drop).
- **Status** (Open / Won / Lost / Abandoned) is separate from stage; typically “Won”/“Lost” map to end stages.

**Vesta:** You already have pipelines with ordered stages and drag-and-drop. Optional: add an explicit **opportunity status** (Open / Won / Lost / Abandoned) if you want reporting/filters like GHL, and map “Closed Won” / “Closed Lost” stages to those statuses.

---

## 6. Automation (GHL)

- Opportunities can be **created** by workflows (e.g. form submit, tag added).
- Triggers: opportunity created, **stage changed**, **status changed**, stale (no activity for X days).

**Vesta:** Your webhook already creates contacts and opportunities. You could add server-side or queue-based “automations” that react to opportunity created / stage changed / status changed to mirror GHL.

---

## 7. Summary: GHL-style flow in Vesta

| GHL concept | How to mirror in Vesta |
|------------|-----------------------------|
| Contact = person | Keep `contacts` collection; one doc per person. |
| Opportunity = deal linked to contact | Keep `opportunities` with `contactId`; support multiple opportunities per contact (same or different pipelines). |
| Pipeline + stages | Keep pipelines and stages; optional: add `status` (Open/Won/Lost/Abandoned). |
| Contact profile shows all opportunities | On contact detail, load opportunities where `contactId == contact.id` and list them. |
| Opportunity card shows contact + deal | Already: pipeline loads contact for each deal; keep syncing name/email/phone to contact when edited on opportunity. |
| Notes/tasks on opportunity also on contact | Option: when adding note to opportunity, also add to contact (or show opportunity notes in contact timeline). |
| Create opportunity from contact | “Create opportunity” from contact profile → create opportunity with that `contactId` and chosen pipeline/stage. |
| Automation (create/update opportunity) | Webhook + optional automation rules on stage/status change. |

---

## 8. Data model recap (your CRM vs GHL)

**Contacts**

- One document per person.
- Fields: name, email, phone, militaryBase, businessName, status, stayStartDate, stayEndDate, tags, formTracking, etc.
- Subcollections: notes, tasks, messages, documents.
- Same idea as GHL “contact”.

**Opportunities**

- One document per deal.
- `contactId` → links to contact (same as GHL “linked contact”).
- `pipelineStageId` → stage in a pipeline (same as GHL pipeline + stage).
- Deal fields: name (or from contact), value, margin, dates, base, notes, assigneeId, leadSourceId, tags, etc.
- Same idea as GHL “opportunity”.

So: **contact vs opportunity flow is already the same as GoHighLevel** (one contact, many opportunities; pipelines and stages; value and assignee). The main optional additions are: explicit **status**, **contact profile → list of opportunities**, and **shared notes/timeline** so it feels like GHL’s “everything on the opportunity card and on the contact.”

---

## 9. Changing a person’s name & creating opportunities for new people (GHL)

### Changing the name of a person (GHL)

- In GHL you **edit the contact’s name and contact information on the opportunity details page**. The UI shows “contact’s name” and “contact information” as editable fields on the opportunity.
- Notes and tasks added on the opportunity **also appear on the linked contact**; the system treats the opportunity as a view into the same person.
- So in practice: **editing name/email/phone on the opportunity updates the linked contact** (or the opportunity simply displays and edits the contact record). Either way, there is one source of truth for the person.

**Vesta:** You already mirror this. When the user saves the opportunity details form, `updateOpportunity` updates both the opportunity and the linked contact’s `name`, `email`, `phone`, `militaryBase`, and stay dates. So changing the name (or any contact info) on the opportunity **does** update the contact record, same idea as GHL.

---

### Creating an opportunity when the person doesn’t exist yet (GHL)

- In GHL you **must have a contact first**. You do not create an opportunity and “invent” a contact in one step.
- **Manual flow:** Create the contact (Contacts → Add Contact → enter name, email, phone → Save). Then create the opportunity (Add Opportunity → **Select a Primary Contact** from your saved contacts → set pipeline, stage, value, etc. → Create).
- **Workflow flow:** Use a “Create Contact” action first, then a “Create Opportunity” action that uses that contact (opportunity name can default to the contact’s name).

So: **contact-first**. The person must exist as a contact before they can be the “primary contact” on an opportunity.

**Vesta options (to match GHL):**

1. **Strict GHL-style (contact-first)**  
   - “Add opportunity” always requires **choosing an existing contact** (search/select).  
   - If the person isn’t in the CRM yet: user goes to Contacts → Add Contact → then Pipeline → Add Opportunity → select that contact.  
   - No “create opportunity with a brand‑new person” in one shot; you create the contact first, then the opportunity.

2. **Convenience variant (still GHL-like)**  
   - “Add opportunity” can show: “Select existing contact” **or** “Create new contact and add opportunity.”  
   - If they choose “Create new contact,” collect name/email/phone (and any other required contact fields), **create the contact first**, then create the opportunity with `contactId` set to that new contact.  
   - Under the hood it’s still contact-first (contact is created before the opportunity); the UI just does both in one flow.

Your **webhook** already does (2): when a lead comes in, you create the contact (or match existing) and then create the opportunity linked to that contact. So for **manual** “add opportunity,” you can either enforce “select existing contact only” (strict GHL) or add a “new contact + opportunity” flow that creates the contact first, then the opportunity.
