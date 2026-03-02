# Connecting WordPress Forms to AFCrashpad CRM via Webhooks

This guide explains how to connect your WordPress Elementor forms to your CRM so that every new inquiry automatically creates a Contact and an Opportunity in your pipeline.

*Note: You are replacing your large Fluent Form with an Elementor Form so you can utilize Elementor's native free webhook support without needing to pay for Fluent Forms Pro.*

---

## 1. Credentials & Endpoints

You will need the following information to configure your form plugin:

- **Webhook URL (Endpoint):** `https://your-crm-domain.com/api/webhooks/leads` *(Replace `your-crm-domain.com` with your actual live CRM domain once deployed. If testing locally, you would need to use a tool like Ngrok `https://<ngrok-id>.ngrok-free.app/api/webhooks/leads`)*
- **Request Method:** `POST`
- **Data Format:** `JSON`
- **Authorization Header:** 
  - **Key:** `Authorization`
  - **Value:** `Bearer <YOUR_WEBHOOK_API_KEY>` *(Use the value of WEBHOOK_API_KEY from your Netlify env vars or `.env`)*

---

## 2. Setting Up the Form Fields in Elementor

To ensure the CRM receives the data correctly, you must map the **Field ID** in Elementor exactly to what the CRM expects.

1. Edit your Elementor Form.
2. Click on a specific field (e.g., the "First Name" box).
3. Go to the **Advanced** tab for that field.
4. Set the **ID** to match the exact keys listed below (it is case-sensitive!):

### Supported Field IDs:
- `first_name` and `last_name` *(Recommended - The CRM will automatically combine these)*
- `name` *(Use this instead if you only have one combined Name box on the form)*
- `email` *(Required)*
- `phone`
- `base`
- `startDate` *(Expected format: YYYY-MM-DD. Use Elementor's native "Date" field type).*
- `endDate` *(Expected format: YYYY-MM-DD).*
- `notes` *(Use this ID for your "Comment / Your Message" box).*

---

## 3. Configuring the Elementor Webhook

Once your fields have the correct IDs:

1. Under the Form's **Content** tab, scroll down to **Actions After Submit**.
2. Click the `+` icon and select **Webhook**.
3. A new **Webhook** dropdown section will appear below. Open it.
4. Set **Webhook URL** to your Endpoint URL from step 1.
5. Toggle **Advanced Data** to `ON`.
6. Add a custom header by clicking `+ Add Item`:
   - Name: `Authorization`
   - Value: `Bearer <YOUR_WEBHOOK_API_KEY>`

---

## 4. Testing the Integration

Once set up, fill out the form on your live website. 
If successful, you will immediately see a new Deal pop up in the "New Lead" stage of your CRM pipeline! If they filled out the Notes field, it will appear under the Notes tab inside the deal card.