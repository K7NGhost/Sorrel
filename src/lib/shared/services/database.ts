import Database from "@tauri-apps/plugin-sql";

let connection: Promise<Database> | undefined;

export function getDatabase(): Promise<Database> {
  connection ??= Database.load("sqlite:sorrel.db").catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
