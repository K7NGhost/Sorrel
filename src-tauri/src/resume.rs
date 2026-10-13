use serde::Serialize;
use std::{fs, time::Duration};
use tauri_plugin_shell::{
    ShellExt,
    process::{Command, CommandEvent},
};

#[derive(Default)]
pub struct ResumeCompiler(pub tokio::sync::Mutex<()>);

#[derive(Serialize)]
pub struct CompiledResume {
    pub pdf: Vec<u8>,
    pub diagnostics: String,
}

#[tauri::command]
pub async fn compile_resume(
    app: tauri::AppHandle,
    compiler: tauri::State<'_, ResumeCompiler>,
    source: String,
) -> Result<CompiledResume, String> {
    // Avoid competing Tectonic processes, particularly during initial package downloads.
    let _guard = compiler.0.lock().await;
    let command = app.shell().sidecar("tectonic").map_err(|error| {
        format!("Tectonic is unavailable: {error}. Run bun run setup:tectonic and restart the app.")
    })?;
    compile_source(&source, command).await
}

async fn compile_source(source: &str, command: Command) -> Result<CompiledResume, String> {
    if source.trim().is_empty() || source.len() > 1024 * 1024 {
        return Err("Enter a LaTeX document under 1 MB.".into());
    }
    let directory =
        tempfile::tempdir().map_err(|error| format!("Could not prepare the compiler: {error}"))?;
    fs::write(directory.path().join("resume.tex"), source)
        .map_err(|error| format!("Could not write LaTeX source: {error}"))?;
    let (mut events, child) = command
        .current_dir(directory.path())
        .args([
            "--untrusted",
            "--color",
            "never",
            "--keep-logs",
            "--outdir",
            ".",
            "resume.tex",
        ])
        .spawn()
        .map_err(|error| format!("Could not start Tectonic: {error}"))?;

    let timeout = tokio::time::sleep(Duration::from_secs(240));
    tokio::pin!(timeout);
    let mut logs: Vec<u8> = Vec::new();
    let exit_code = loop {
        tokio::select! {
            _ = &mut timeout => {
                let _ = child.kill();
                return Err("Compilation timed out. Check your source or your connection for the first package download, then try again.".into());
            }
            event = events.recv() => {
                match event {
                    Some(CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes)) => {
                        logs.extend(bytes);
                        logs.push(b'\n');
                        if logs.len() > 64 * 1024 { logs.drain(..logs.len() - 64 * 1024); }
                    }
                    Some(CommandEvent::Error(error)) => {
                        let _ = child.kill();
                        return Err(format!("Tectonic failed: {error}"));
                    }
                    Some(CommandEvent::Terminated(payload)) => break payload.code,
                    None => break None,
                    _ => {}
                }
            }
        }
    };
    let diagnostics = String::from_utf8_lossy(&logs).into_owned();
    if exit_code != Some(0) {
        return Err(if diagnostics.trim().is_empty() {
            "Tectonic could not compile this document.".into()
        } else {
            diagnostics
        });
    }
    let pdf = fs::read(directory.path().join("resume.pdf"))
        .map_err(|error| format!("Tectonic produced no PDF: {error}\n{diagnostics}"))?;
    if !pdf.starts_with(b"%PDF-") || pdf.len() > 20 * 1024 * 1024 {
        return Err("The compiler did not produce a valid PDF under 20 MB.".into());
    }
    Ok(CompiledResume { pdf, diagnostics })
}
