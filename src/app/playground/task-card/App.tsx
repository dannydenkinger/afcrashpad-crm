import { AnimatedDesignSystemCard } from "./AnimatedDesignSystemCard";

export default function App() {
  return (
    <main className="min-h-screen overflow-hidden bg-page px-4 py-10 text-ink antialiased">
      <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center">
        <AnimatedDesignSystemCard />
      </div>
    </main>
  );
}
