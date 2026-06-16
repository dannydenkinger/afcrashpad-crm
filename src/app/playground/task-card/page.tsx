"use client"

import { AnimatedDesignSystemCard } from "./AnimatedDesignSystemCard"

// Preview route for the sent component. The sender shipped this as a standalone
// Vite app (main.tsx / App.tsx / index.css); in Next we just render the card
// from a `page.tsx`. The page bg + ink text mirror their index.css `:root`.
export default function TaskCardPlaygroundPage() {
    return (
        <div
            className="min-h-[100dvh] flex items-center justify-center overflow-hidden px-4 py-10 antialiased"
            style={{ background: "#f7f7f5", color: "#262624" }}
        >
            <AnimatedDesignSystemCard />
        </div>
    )
}
