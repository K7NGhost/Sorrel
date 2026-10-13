export const applicationColumns = [
  { status: "applied", label: "Applied", badge: "badge-info", hint: "Your next opportunity starts here." },
  { status: "rejected", label: "Rejected", badge: "badge-error", hint: "Keep a record and keep moving." },
  { status: "accepted", label: "Accepted", badge: "badge-success", hint: "Good news belongs here." },
] as const;

export type ApplicationStatus = (typeof applicationColumns)[number]["status"];

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  notes: string;
  job_description: string;
  status: ApplicationStatus;
  applied_on: string;
  created_at: string;
  updated_at: string;
  sort_order: number;
}

export type NewApplication = Pick<JobApplication, "company" | "role" | "notes" | "applied_on"> & { job_description?: string };

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return applicationColumns.some((column) => column.status === value);
}
