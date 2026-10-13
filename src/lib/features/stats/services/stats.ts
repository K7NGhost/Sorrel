import { getDatabase } from "$lib/shared/services/database";

export interface ApplicationSnapshot {
  company: string;
  status: "applied" | "rejected" | "accepted";
  applied_on: string;
}

export function summarizeApplications(applications: ApplicationSnapshot[], now = new Date()) {
  const counts = { applied: 0, rejected: 0, accepted: 0 };
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString(undefined, { month: "short", year: "numeric" }),
      count: 0,
    };
  });
  for (const application of applications) {
    counts[application.status] += 1;
    const month = months.find((item) => item.key === application.applied_on.slice(0, 7));
    if (month) month.count += 1;
  }
  const decided = counts.accepted + counts.rejected;
  return {
    total: applications.length,
    companies: new Set(applications.map((item) => item.company.trim().toLowerCase())).size,
    counts,
    acceptanceRate: decided ? Math.round(counts.accepted / decided * 100) : null,
    months,
  };
}

export async function getApplicationStats() {
  const db = await getDatabase();
  const applications = await db.select<ApplicationSnapshot[]>("SELECT company, status, applied_on FROM applications");
  return summarizeApplications(applications);
}

export type ApplicationStats = ReturnType<typeof summarizeApplications>;
