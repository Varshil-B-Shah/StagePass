import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function BookingConfirmationPage({ params }: { params: { id: string } }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Booking Confirmed!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">Confirmed</Badge>
          <p className="text-sm text-muted-foreground">Booking reference:</p>
          <p className="font-mono text-sm break-all">{params.id}</p>
          <p className="text-sm text-muted-foreground mt-2">
            A confirmation email has been sent to your registered address.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
