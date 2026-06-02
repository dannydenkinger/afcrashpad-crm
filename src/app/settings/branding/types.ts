export interface BrandingSettings {
    companyName?: string
    primaryColor?: string
    /** Optional secondary/accent color used for buttons, links, headings. */
    secondaryColor?: string
    /** Optional brand text color (defaults to a near-black). */
    textColor?: string
    /** Workspace logo — used in email headers + auto-injected by starter templates. */
    logoUrl?: string
    /** Plain-text physical address — required by CAN-SPAM in email footers. */
    footerAddress?: string
    /** Optional brand font family (CSS stack), e.g. "Inter, system-ui, sans-serif". */
    fontFamily?: string
    /** Public website URL for the brand (used in default footer / unsubscribe page). */
    websiteUrl?: string
    /**
     * Calendly / Cal.com / SavvyCal / etc. booking link. When set, the
     * contact-detail sheet shows a "Send my booking link" quick action
     * that pastes the URL into the message composer.
     */
    bookingLinkUrl?: string
}
