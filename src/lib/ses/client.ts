import { SESv2Client } from "@aws-sdk/client-sesv2"

let cachedClient: SESv2Client | null = null

export function getSesClient(): SESv2Client {
    if (cachedClient) return cachedClient

    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
    if (!region) {
        throw new Error("AWS_REGION env var is required for SES")
    }
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    if (!accessKeyId || !secretAccessKey) {
        throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars are required for SES")
    }

    cachedClient = new SESv2Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
    })
    return cachedClient
}

export function getConfigurationSetName(): string | undefined {
    return process.env.SES_CONFIGURATION_SET_NAME || undefined
}
