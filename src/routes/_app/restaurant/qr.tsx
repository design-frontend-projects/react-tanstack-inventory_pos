import { createFileRoute } from '@tanstack/react-router'
import { QrWorkspace } from '#/features/restaurant/guests/qr-workspace'

export const Route = createFileRoute('/_app/restaurant/qr')({
  component: QrPage,
})

function QrPage() {
  return <QrWorkspace />
}
