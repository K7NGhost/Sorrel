import { execFile } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import assert from "node:assert/strict";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8", windowsHide: true }).trim();
const binary = join(root, "src-tauri", "binaries", `tectonic-${target}${process.platform === "win32" ? ".exe" : ""}`);
const directory = mkdtempSync(join(root, "tests", ".tectonic-"));
const source = String.raw`\documentclass{article}
\usepackage[margin=0.7in]{geometry}
\usepackage{fontspec}
\usepackage{hyperref}
\setmainfont{lmroman10-regular.otf}
\begin{document}
\section*{Tectonic Resume}
\href{https://example.com}{Portfolio}
\begin{itemize}\item Full XeLaTeX package compilation.\end{itemize}
\end{document}`;
const args = ["--untrusted", "--color", "never", "--keep-logs", "--outdir", ".", "resume.tex"];
const run = async () => {
  try { return await promisify(execFile)(binary, args, { cwd: directory, windowsHide: true, timeout: 240000, maxBuffer: 16 * 1024 * 1024 }); }
  catch (error) { throw new Error(`Tectonic failed:\n${`${error.stdout ?? ""}\n${error.stderr ?? ""}`.slice(-2500)}`); }
};
try {
  writeFileSync(join(directory, "resume.tex"), source);
  await run();
  const pdf = readFileSync(join(directory, "resume.pdf"));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1000);
  if (process.argv.includes("--update-fixture")) {
    const fixtures = join(root, "e2e", "fixtures");
    mkdirSync(fixtures, { recursive: true });
    writeFileSync(join(fixtures, "tectonic-resume.pdf"), pdf);
  }
  console.log(`Real Tectonic compile passed: geometry, fontspec, hyperref (${pdf.length} PDF bytes).`);
  const starterFile = readFileSync(join(root, "src/lib/features/resume-builder/templates/starter.ts"), "utf8");
  const starter = /String\.raw`([\s\S]*)`;/.exec(starterFile)?.[1];
  assert.ok(starter, "Could not read the starter template");
  writeFileSync(join(directory, "resume.tex"), starter);
  await run();
  assert.equal(readFileSync(join(directory, "resume.pdf")).subarray(0, 5).toString(), "%PDF-");
  console.log("The bundled starter resume compiles successfully.");
  writeFileSync(join(directory, "resume.tex"), String.raw`\documentclass{article}\begin{document}\invalidresumecommand\end{document}`);
  await assert.rejects(run(), (error) => {
    assert.match(error.message, /invalidresumecommand|Undefined control sequence/i);
    return true;
  });
  console.log("Invalid LaTeX correctly fails compilation.");
} finally {
  assert.ok(directory.startsWith(join(root, "tests")));
  rmSync(directory, { recursive: true, force: true });
}
