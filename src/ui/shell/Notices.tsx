import { Alert } from "@/components/arc/alert/alert"
import { Button } from "@/components/ui/button"
import { useNotices } from "@/state/notices"

/** Persistent notices: migrations, storage problems, failed opens. They stay until dismissed or resolved. */
export function Notices() {
  const notices = useNotices((state) => state.notices)
  const dismiss = useNotices((state) => state.dismiss)
  if (!notices.length) return null
  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-background px-3 py-2" aria-label="Avisos">
      {notices.map((notice) => (
        <Alert key={notice.id} tone={notice.tone} title={notice.title} onDismiss={notice.dismissible ? () => dismiss(notice.id) : undefined}>
          {notice.body ? <p>{notice.body}</p> : null}
          {notice.details?.length ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs font-medium">Ver detalles ({notice.details.length})</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                {notice.details.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {notice.actions?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {notice.actions.map((action) => (
                <Button key={action.label} size="sm" variant={action.primary ? "default" : "outline"} onClick={() => void action.run()}>
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </Alert>
      ))}
    </div>
  )
}
