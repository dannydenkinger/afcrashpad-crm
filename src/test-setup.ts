import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement these browser APIs. Components that use them
// (e.g. KanbanView's ResizeObserver scroll affordance, infinite-scroll
// IntersectionObservers, responsive matchMedia) would otherwise throw on mount.
class MockObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return []
    }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = MockObserver as unknown as typeof ResizeObserver
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = MockObserver as unknown as typeof IntersectionObserver
}

if (typeof globalThis.matchMedia === 'undefined') {
    globalThis.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof matchMedia
}
