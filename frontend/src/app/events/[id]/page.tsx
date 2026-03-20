interface EventPageProps {
  params: { id: string }
}

export const revalidate = 60

export default function EventPage({ params }: EventPageProps) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-4">Event {params.id}</h1>
      <a
        href={`/events/${params.id}/seats`}
        className="inline-block rounded bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700"
      >
        Select seats
      </a>
    </main>
  )
}
