export const revalidate = 60   // ISR: revalidate every 60 seconds

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">StagePass</h1>
      <p className="text-gray-500 mb-8">Upcoming events</p>
      <p className="text-gray-400 italic">
        Event listing coming in Chunk 8 — seed an event and it will appear here.
      </p>
    </main>
  )
}
