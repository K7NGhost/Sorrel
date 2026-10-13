import type { ApplicationStatus, JobApplication } from "../types";

/** Merge visible drag order into the complete column without losing filtered-out cards. */
export function planPlacement(applications: JobApplication[], id: string, status: ApplicationStatus, visibleOrder?: string[]) {
  const moved = applications.find((application) => application.id === id);
  if (!moved) throw new Error("This application could not be found.");
  const target = applications.filter((application) => application.status === status && application.id !== id);
  const order = visibleOrder ?? [id, ...target.map((application) => application.id)];
  const allowed = new Set([id, ...target.map((application) => application.id)]);
  if (!order.includes(id) || new Set(order).size !== order.length || order.some((key) => !allowed.has(key))) {
    throw new Error("The column order is invalid.");
  }

  const movedIndex = order.indexOf(id);
  const nextId = order[movedIndex + 1];
  const previousId = order[movedIndex - 1];
  const insertionIndex = nextId ? target.findIndex((item) => item.id === nextId)
    : previousId ? target.findIndex((item) => item.id === previousId) + 1 : 0;
  target.splice(insertionIndex, 0, moved);
  const visibleIds = new Set(order);
  const byId = new Map(target.map((application) => [application.id, application]));
  let visibleIndex = 0;
  const placed = target.map((application, index) => ({
    ...(visibleIds.has(application.id) ? byId.get(order[visibleIndex++])! : application),
    status,
    sort_order: index,
  }));
  const remaining = applications.filter((application) => application.id !== id && application.status !== status);
  return {
    applications: [...remaining, ...placed].sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)),
    orderedIds: placed.map((application) => application.id),
  };
}
