use tauri_plugin_sql::{Migration, MigrationKind};
mod resume;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(resume::ResumeCompiler::default())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![resume::compile_resume])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:sorrel.db",
                    vec![
                        Migration {
                            version: 1,
                            description: "create_applications",
                            sql: include_str!("../migrations/001_create_applications.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 2,
                            description: "create_documents",
                            sql: include_str!("../migrations/002_create_documents.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 3,
                            description: "application_order",
                            sql: include_str!("../migrations/003_application_order.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 4,
                            description: "resume_draft",
                            sql: include_str!("../migrations/004_resume_draft.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 5,
                            description: "resume_files",
                            sql: include_str!("../migrations/005_resume_files.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 6,
                            description: "resume_folders",
                            sql: include_str!("../migrations/006_resume_folders.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 7,
                            description: "document_folders",
                            sql: include_str!("../migrations/007_document_folders.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 8,
                            description: "job_description",
                            sql: include_str!("../migrations/008_job_description.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 9,
                            description: "resume_folder_delete",
                            sql: include_str!("../migrations/009_resume_folder_delete.sql"),
                            kind: MigrationKind::Up,
                        },
                        Migration {
                            version: 10,
                            description: "document_folder_delete",
                            sql: include_str!("../migrations/010_document_folder_delete.sql"),
                            kind: MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
