"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, SectionTitle, SkeletonBlock } from "@/components/ui";
import { buildApiUrl, fetchApi, isApiError } from "@/lib/api";

type NotificationType =
  | "review_completed"
  | "review_failed"
  | "comment_mentioned"
  | "job_assigned"
  | "repository_synced";

type NotificationRecord = {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly actionUrl: string | null;
  readonly unread: boolean;
  readonly createdAt: string;
  readonly readAt: string | null;
};

type InboxResponse = {
  readonly notifications: NotificationRecord[];
  readonly unreadCount: number;
};

type InboxState = {
  readonly notifications: NotificationRecord[];
  readonly unreadCount: number;
};

const streamEventTypes: NotificationType[] = [
  "review_completed",
  "review_failed",
  "comment_mentioned",
  "job_assigned",
  "repository_synced",
];

function sortNotifications(notifications: NotificationRecord[]): NotificationRecord[] {
  return [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function upsertNotification(
  state: InboxState,
  incoming: NotificationRecord,
): InboxState {
  const existing = state.notifications.find((notification) => notification.id === incoming.id);
  const notifications = sortNotifications([
    incoming,
    ...state.notifications.filter((notification) => notification.id !== incoming.id),
  ]);

  let unreadCount = state.unreadCount;
  if (!existing && incoming.unread) {
    unreadCount += 1;
  }
  if (existing && existing.unread !== incoming.unread) {
    unreadCount += incoming.unread ? 1 : -1;
  }

  return {
    notifications,
    unreadCount: Math.max(unreadCount, 0),
  };
}

function parseIncomingNotification(payload: string): NotificationRecord | null {
  try {
    const parsed = JSON.parse(payload) as Partial<NotificationRecord>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (
      typeof parsed.id !== "string"
      || typeof parsed.title !== "string"
      || typeof parsed.body !== "string"
      || typeof parsed.type !== "string"
      || typeof parsed.createdAt !== "string"
    ) {
      return null;
    }

    return {
      id: parsed.id,
      title: parsed.title,
      body: parsed.body,
      type: parsed.type as NotificationType,
      createdAt: parsed.createdAt,
      unread: Boolean(parsed.unread),
      actionUrl: parsed.actionUrl ?? null,
      readAt: parsed.readAt ?? null,
    };
  } catch {
    return null;
  }
}

function typeToTone(type: NotificationType): "good" | "warn" | "bad" | "neutral" {
  if (type === "review_failed") {
    return "bad";
  }
  if (type === "review_completed" || type === "repository_synced") {
    return "good";
  }
  if (type === "comment_mentioned") {
    return "warn";
  }
  return "neutral";
}

function typeLabel(type: NotificationType): string {
  return type.replace(/_/g, " ");
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function NotificationsInboxPage() {
  const [inbox, setInbox] = useState<InboxState>({ notifications: [], unreadCount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreamConnected, setIsStreamConnected] = useState(false);

  const hydrateInbox = useCallback(async () => {
    const data = await fetchApi<InboxResponse>("/notifications");
    setInbox({
      notifications: sortNotifications(data.notifications),
      unreadCount: data.unreadCount,
    });
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let fallbackPollTimer: number | null = null;

    const startPollingFallback = () => {
      if (fallbackPollTimer !== null) {
        return;
      }

      fallbackPollTimer = window.setInterval(() => {
        void hydrateInbox().catch((pollError: unknown) => {
          console.error("notifications.poll.failed", pollError);
          if (!cancelled) {
            setError(
              isApiError(pollError)
                ? `Unable to load notifications (${pollError.status}).`
                : "Unable to load notifications.",
            );
          }
        });
      }, 15000);
    };

    const stopPollingFallback = () => {
      if (fallbackPollTimer !== null) {
        window.clearInterval(fallbackPollTimer);
        fallbackPollTimer = null;
      }
    };

    async function loadAndSubscribe() {
      try {
        await hydrateInbox();
        if (cancelled) {
          return;
        }

        const streamUrl = await buildApiUrl("/notifications/stream");
        if (cancelled) {
          return;
        }

        eventSource = new EventSource(streamUrl, {
          withCredentials: true,
        });

        const handleStreamMessage = (event: MessageEvent<string>) => {
          const incoming = parseIncomingNotification(event.data);
          if (!incoming) {
            return;
          }

          setInbox((previous) => upsertNotification(previous, incoming));
        };

        eventSource.addEventListener("message", handleStreamMessage);
        for (const eventType of streamEventTypes) {
          eventSource.addEventListener(eventType, handleStreamMessage);
        }

        eventSource.onerror = () => {
          setIsStreamConnected(false);
          if (!cancelled) {
            setError((previous) => previous ?? "Temporary server issue.");
            startPollingFallback();
          }
        };

        eventSource.onopen = () => {
          setIsStreamConnected(true);
          if (!cancelled) {
            setError(null);
            stopPollingFallback();
          }
        };
      } catch (loadError: unknown) {
        console.error("notifications.load.failed", loadError);
        if (!cancelled) {
          setError(
            isApiError(loadError)
              ? `Unable to load notifications (${loadError.status}).`
              : "Unable to load notifications.",
          );
          startPollingFallback();
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAndSubscribe();

    return () => {
      cancelled = true;
      if (eventSource) {
        eventSource.close();
      }
      stopPollingFallback();
    };
  }, [hydrateInbox]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setInbox((previous) => {
      const current = previous.notifications.find((item) => item.id === notificationId);
      if (!current || !current.unread) {
        return previous;
      }

      return {
        unreadCount: Math.max(previous.unreadCount - 1, 0),
        notifications: previous.notifications.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                unread: false,
                readAt: new Date().toISOString(),
              }
            : item,
        ),
      };
    });

    try {
      await fetchApi<unknown>(`/notifications/${notificationId}/read`, { method: "POST" });
      setError(null);
    } catch (readError: unknown) {
      console.error("notifications.read.failed", readError);
      setError("Unable to update notification state.");
      try {
        await hydrateInbox();
      } catch (refreshError: unknown) {
        console.error("notifications.refresh.failed", refreshError);
        // Keep optimistic state if reload fails.
      }
    }
  }, [hydrateInbox]);

  const markAllAsRead = useCallback(async () => {
    setIsMarkingAll(true);
    const snapshot = inbox;

    setInbox((previous) => ({
      unreadCount: 0,
      notifications: previous.notifications.map((notification) => ({
        ...notification,
        unread: false,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
    }));

    try {
      await fetchApi<unknown>("/notifications/read-all", { method: "POST" });
      setError(null);
    } catch (markAllError: unknown) {
      console.error("notifications.readAll.failed", markAllError);
      setInbox(snapshot);
      setError("Unable to update notification state.");
    } finally {
      setIsMarkingAll(false);
    }
  }, [inbox]);

  const hasUnread = inbox.unreadCount > 0;
  const emptyState = useMemo(
    () => !isLoading && inbox.notifications.length === 0,
    [inbox.notifications.length, isLoading],
  );

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            title="Notification inbox"
            subtitle="Realtime review updates"
          />
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                label={isStreamConnected ? "Live" : "Reconnecting"}
                tone={isStreamConnected ? "good" : "warn"}
              />
              <Badge
                label={`${inbox.unreadCount} unread`}
                tone={hasUnread ? "warn" : "neutral"}
              />
              <button
                type="button"
                onClick={() => {
                  void markAllAsRead();
                }}
                disabled={!hasUnread || isMarkingAll}
                className="rounded-full border border-(--app-border) px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-(--app-panel-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-accent) disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMarkingAll ? "Marking..." : "Mark all read"}
              </button>
            </div>
            <div className="text-xs text-(--app-muted)">
              Review events stream in realtime and stay pinned to the top of the inbox.
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-(--app-danger)/40 bg-(--app-danger)/10 px-4 py-3 text-sm text-foreground">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-(--app-border) px-4 py-4"
                aria-hidden="true"
              >
                <SkeletonBlock className="h-4 w-2/5" />
                <SkeletonBlock className="mt-2 h-3 w-full" />
                <SkeletonBlock className="mt-2 h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : null}

        {emptyState ? (
          <div className="rounded-2xl border border-(--app-border) px-4 py-8 text-center text-sm text-(--app-muted)">
            <div className="font-semibold text-foreground">No notifications yet</div>
            <div className="mt-1 text-xs text-(--app-muted)">
              New review events and mentions will appear here in realtime.
            </div>
          </div>
        ) : null}

        {!isLoading && inbox.notifications.length > 0 ? (
          <div className="space-y-3">
            {inbox.notifications.map((notification) => (
              <div
                key={notification.id}
                className={[
                  "rounded-2xl border border-(--app-border) px-4 py-3 transition hover:bg-(--app-panel-strong)/30",
                  notification.unread ? "border-l-4 border-l-(--app-accent)" : "",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">
                        {notification.title}
                      </div>
                      {notification.unread ? <Badge label="unread" tone="warn" /> : null}
                      <Badge label={typeLabel(notification.type)} tone={typeToTone(notification.type)} />
                    </div>
                    <div className="mt-1 text-sm text-(--app-muted)">{notification.body}</div>
                    <div className="mt-2 text-xs text-(--app-muted)">
                      {formatTimestamp(notification.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {notification.actionUrl ? (
                      <a
                        href={notification.actionUrl}
                        className="rounded-full border border-(--app-border) px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-(--app-panel-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-accent)"
                      >
                        Open
                      </a>
                    ) : null}
                    <button
                      type="button"
                      disabled={!notification.unread}
                      onClick={() => {
                        void markAsRead(notification.id);
                      }}
                      className="rounded-full bg-(--app-accent) px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--app-accent) disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Mark read
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
