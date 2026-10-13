import { getDatabase } from "$lib/shared/services/database";
import { isApplicationStatus, type ApplicationStatus, type JobApplication, type NewApplication } from "../types";

export async function listApplications(): Promise<JobApplication[]> {
  const db = await getDatabase();
  return db.select<JobApplication[]>("SELECT * FROM applications ORDER BY sort_order ASC, created_at DESC, id DESC");
}

export async function createApplication(input: NewApplication): Promise<JobApplication> {
  const company = input.company.trim();
  if (!company) throw new Error("Enter a company name.");
  const appliedDate = new Date(`${input.applied_on}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.applied_on)
    || Number.isNaN(appliedDate.getTime())
    || appliedDate.toISOString().slice(0, 10) !== input.applied_on) {
    throw new Error("Enter a valid application date.");
  }

  const now = new Date().toISOString();
  validateDetails(input.notes, input.job_description ?? "");
  const application: JobApplication = {
    ...input,
    company,
    role: input.role.trim(),
    notes: input.notes.trim(),
    job_description: (input.job_description ?? "").trim(),
    id: crypto.randomUUID(),
    status: "applied",
    created_at: now,
    updated_at: now,
    sort_order: -Date.now(),
  };
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO applications (id, company, role, notes, status, applied_on, created_at, updated_at, sort_order, job_description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [application.id, company, application.role, application.notes, application.status,
      application.applied_on, now, now, application.sort_order, application.job_description],
  );
  return application;
}

function validateDetails(notes: string, description: string) {
  if (notes.length > 5000) throw new Error("Keep notes under 5,000 characters.");
  if (description.length > 50000) throw new Error("Keep the job description under 50,000 characters.");
}

export async function updateApplicationDetails(id: string, notes: string, description: string): Promise<Pick<JobApplication, "notes" | "job_description" | "updated_at">> {
  validateDetails(notes, description);
  const details = { notes: notes.trim(), job_description: description.trim(), updated_at: new Date().toISOString() };
  const db = await getDatabase();
  const result = await db.execute("UPDATE applications SET notes = $1, job_description = $2, updated_at = $3 WHERE id = $4", [details.notes, details.job_description, details.updated_at, id]);
  if (result.rowsAffected !== 1) throw new Error("This application could not be found. Reload the board.");
  return details;
}

export async function moveApplication(id: string, status: ApplicationStatus, orderedIds?: string[]): Promise<string> {
  if (!isApplicationStatus(status)) throw new Error("Choose a valid application status.");
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();
  if (orderedIds) {
    if (!orderedIds.includes(id) || new Set(orderedIds).size !== orderedIds.length) {
      throw new Error("The column order is invalid.");
    }
    // One guarded statement updates status and order atomically. If a card is missing
    // or belongs to another column, the entire statement leaves the board unchanged.
    const values = orderedIds.map((_, index) => `($${index + 4}, ${index})`).join(", ");
    const result = await db.execute(
      `WITH move_data(moved_id, new_status, modified_at) AS (VALUES ($1, $2, $3)),
       ordering(id, position) AS (VALUES ${values})
       UPDATE applications
       SET status = $2,
           sort_order = (SELECT position FROM ordering WHERE ordering.id = applications.id),
           updated_at = CASE WHEN id = $1 THEN $3 ELSE updated_at END
       WHERE id IN (SELECT id FROM ordering)
         AND (SELECT COUNT(*) FROM applications
              WHERE id IN (SELECT id FROM ordering) AND (status = $2 OR id = $1)) = ${orderedIds.length}`,
      [id, status, updatedAt, ...orderedIds],
    );
    if (result.rowsAffected !== orderedIds.length) throw new Error("The board changed. Reload it and try again.");
    return updatedAt;
  }
  const result = await db.execute(
    "UPDATE applications SET status = $1, updated_at = $2 WHERE id = $3",
    [status, updatedAt, id],
  );
  if (result.rowsAffected !== 1) throw new Error("This application could not be found. Reload the board.");
  return updatedAt;
}
