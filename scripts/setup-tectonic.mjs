import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const version = "0.17.0";
const target = process.env.TAURI_ENV_TARGET_TRIPLE || execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8", windowsHide: true }).trim();
if (!/^[a-z0-9_-]+$/.test(target)) throw new Error("Invalid Rust target triple.");
const root = fileURLToPath(new URL("../src-tauri/binaries/", import.meta.url));
const windows = target.includes("windows");
const destination = join(root, `tectonic-${target}${windows ? ".exe" : ""}`);
mkdirSync(root, { recursive: true });

if (existsSync(destination)) {
  const installed = execFileSync(destination, ["--version"], { encoding: "utf8", windowsHide: true }).trim();
  if (installed === `Tectonic ${version}` && existsSync(join(root, "TECTONIC-LICENSE.txt"))) {
    console.log(`${installed} is ready for ${target}.`);
    process.exit(0);
  }
}

const headers = { "User-Agent": "Sorrel-Tectonic-Setup", Accept: "application/vnd.github+json" };
const releaseResponse = await fetch(`https://api.github.com/repos/tectonic-typesetting/tectonic/releases/tags/tectonic%40${version}`, { headers });
if (!releaseResponse.ok) throw new Error(`Could not read the Tectonic release: HTTP ${releaseResponse.status}`);
const release = await releaseResponse.json();
const suffix = windows ? ".zip" : ".tar.gz";
const asset = release.assets.find((item) => item.name === `tectonic-${version}-${target}${suffix}`);
if (!asset) throw new Error(`No Tectonic ${version} release is available for ${target}. Add the matching binary to src-tauri/binaries manually.`);
if (!asset.digest?.startsWith("sha256:")) throw new Error("The release asset has no SHA-256 checksum.");
const response = await fetch(asset.browser_download_url, { headers });
if (!response.ok) throw new Error(`Could not download Tectonic: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const digest = createHash("sha256").update(bytes).digest("hex");
if (`sha256:${digest}` !== asset.digest) throw new Error("The Tectonic download checksum did not match.");

const temporary = mkdtempSync(join(root, ".setup-"));
try {
  const archive = join(temporary, `release${suffix}`);
  const extracted = join(temporary, "extracted");
  mkdirSync(extracted);
  writeFileSync(archive, bytes);
  if (windows) {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      "Expand-Archive -LiteralPath $env:SORREL_ARCHIVE -DestinationPath $env:SORREL_EXTRACT -Force"],
      { env: { ...process.env, SORREL_ARCHIVE: archive, SORREL_EXTRACT: extracted }, windowsHide: true });
  } else {
    execFileSync("tar", ["-xzf", archive, "-C", extracted]);
  }
  function findBinary(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isFile() && entry.name === (windows ? "tectonic.exe" : "tectonic")) return path;
      if (entry.isDirectory()) { const found = findBinary(path); if (found) return found; }
    }
  }
  const binary = findBinary(extracted);
  if (!binary) throw new Error("The release archive did not contain the Tectonic executable.");
  copyFileSync(binary, destination);
  if (!windows) chmodSync(destination, 0o755);
  // Keep the upstream license with the redistributed executable.
  const license = await fetch(`https://raw.githubusercontent.com/tectonic-typesetting/tectonic/tectonic%40${version}/LICENSE`);
  if (!license.ok) throw new Error("Could not retrieve Tectonic's license.");
  writeFileSync(join(root, "TECTONIC-LICENSE.txt"), await license.text());
  console.log(execFileSync(destination, ["--version"], { encoding: "utf8", windowsHide: true }).trim());
} finally {
  if (!temporary.startsWith(root)) throw new Error("Unexpected setup workspace.");
  rmSync(temporary, { recursive: true, force: true });
}
