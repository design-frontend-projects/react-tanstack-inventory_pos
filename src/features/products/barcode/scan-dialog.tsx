'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { getAccessToken } from '#/features/auth/browser-auth'
import { usePreferencesStore } from '#/features/preferences/preferences-store'
import { listProductsPageServerFn } from '#/features/products/server-functions'
import { notifyError } from '#/lib/toast/toast-store'
import type { LabelProduct } from '#/features/products/barcode/label-print-dialog'

// Barcode scan lookup for the catalog. Hardware scanners act as keyboards
// (type + Enter), so an auto-focused input is the primary path; browsers with
// the native BarcodeDetector API additionally get camera scanning.

type ScanMatch = Awaited<
  ReturnType<typeof listProductsPageServerFn>
>['items'][number]

interface DetectedBarcode {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<DetectedBarcode>>
}

type BarcodeDetectorCtor = new (options?: {
  formats?: Array<string>
}) => BarcodeDetectorLike

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  const ctor = (window as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector
  return ctor ?? null
}

// Exact barcode hits first, then exact SKU, then partial matches.
function rankMatches(items: Array<ScanMatch>, code: string): Array<ScanMatch> {
  const needle = code.trim().toLowerCase()
  const score = (item: ScanMatch) =>
    item.barcode?.toLowerCase() === needle
      ? 0
      : item.sku.toLowerCase() === needle
        ? 1
        : 2

  return [...items].sort((a, b) => score(a) - score(b))
}

interface ScanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrintLabel: (product: LabelProduct) => void
}

export function ScanDialog({
  open,
  onOpenChange,
  onPrintLabel,
}: ScanDialogProps) {
  const tenantId = usePreferencesStore((state) => state.activeTenantId)
  const [code, setCode] = React.useState('')
  const [matches, setMatches] = React.useState<Array<ScanMatch> | null>(null)
  const [cameraActive, setCameraActive] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  const supportsCamera =
    typeof window !== 'undefined' && getBarcodeDetector() !== null

  const lookup = useMutation({
    mutationFn: async (scanned: string) => {
      const accessToken = await getAccessToken()

      if (!accessToken || !tenantId) {
        throw new Error('Sign in and select a workspace before scanning.')
      }

      const page = await listProductsPageServerFn({
        data: {
          accessToken,
          tenantId,
          filters: { search: scanned, take: 10 },
        },
      })

      return rankMatches(page.items, scanned)
    },
    onSuccess: (ranked) => setMatches(ranked),
    onError: (error: unknown) => notifyError(error, 'Scan lookup failed'),
  })

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  const submitCode = React.useCallback(
    (scanned: string) => {
      const trimmed = scanned.trim()
      if (!trimmed) {
        return
      }
      setCode(trimmed)
      setMatches(null)
      lookup.mutate(trimmed)
    },
    [lookup],
  )

  // Reset on close and always release the camera.
  React.useEffect(() => {
    if (!open) {
      setCode('')
      setMatches(null)
      stopCamera()
    }
  }, [open, stopCamera])

  React.useEffect(() => stopCamera, [stopCamera])

  // Camera loop: sample frames until the detector reports a value.
  React.useEffect(() => {
    if (!cameraActive) {
      return
    }

    const Detector = getBarcodeDetector()
    const video = videoRef.current

    if (!Detector || !video) {
      return
    }

    let disposed = false
    const detector = new Detector()

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        video.srcObject = stream
        return video.play()
      })
      .catch((error: unknown) => {
        notifyError(error, 'Could not access the camera')
        setCameraActive(false)
      })

    const interval = window.setInterval(() => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return
      }
      detector
        .detect(video)
        .then((barcodes) => {
          const value = barcodes[0]?.rawValue
          if (value && !disposed) {
            stopCamera()
            submitCode(value)
          }
        })
        .catch(() => {
          // Individual frames may fail to decode; keep sampling.
        })
    }, 350)

    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [cameraActive, stopCamera, submitCode])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan a barcode</DialogTitle>
          <DialogDescription>
            Scan with a handheld scanner (or type a barcode / SKU) and press
            Enter to find the product.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitCode(code)
                }
              }}
              placeholder="Scan or type a barcode…"
              className="font-mono"
            />
            <Button
              variant="outline"
              onClick={() => submitCode(code)}
              disabled={lookup.isPending || code.trim() === ''}
            >
              {lookup.isPending ? 'Searching…' : 'Find'}
            </Button>
          </div>

          {supportsCamera ? (
            <div className="flex flex-col gap-2">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className="aspect-video w-full rounded-lg border border-border bg-black object-cover"
                  />
                  <Button variant="outline" size="sm" onClick={stopCamera}>
                    Stop camera
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCameraActive(true)}
                >
                  Scan with camera
                </Button>
              )}
            </div>
          ) : null}

          {matches !== null ? (
            matches.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                No product matches “{code}”. Check the code or create the
                product first.
              </div>
            ) : (
              <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {matches.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {product.name}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {product.sku}
                        {product.barcode ? ` · ${product.barcode}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="xs" variant="outline" asChild>
                        <Link
                          to="/inventory/catalog/$productId"
                          params={{ productId: product.id }}
                          onClick={() => onOpenChange(false)}
                        >
                          View
                        </Link>
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => onPrintLabel(product)}
                      >
                        Label
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
