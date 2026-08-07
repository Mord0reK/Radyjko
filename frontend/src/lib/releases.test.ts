import assert from "node:assert/strict";
import test from "node:test";
import { formatFileSize, parseLatestRelease } from "./releases";

test("maps supported assets from the latest GitHub release", () => {
  const release = parseLatestRelease({
    tag_name: "v3.1.5",
    published_at: "2026-08-06T13:19:28Z",
    assets: [
      {
        name: "Radyjko-3.1.5.apk",
        browser_download_url: "https://github.com/Mord0reK/Radyjko/releases/download/v3.1.5/Radyjko-3.1.5.apk",
        size: 10,
      },
      {
        name: "Radyjko_3.1.5_x64-setup.exe",
        browser_download_url: "https://github.com/Mord0reK/Radyjko/releases/download/v3.1.5/Radyjko.exe",
        size: 20,
      },
      {
        name: "radyjko-3.1.5-1-x86_64.pkg.tar.zst",
        browser_download_url: "https://github.com/Mord0reK/Radyjko/releases/download/v3.1.5/radyjko.pkg.tar.zst",
        size: 30,
      },
    ],
  });

  assert.equal(release.version, "3.1.5");
  assert.deepEqual(release.assets.map((asset) => asset.kind), [
    "android-apk",
    "windows-exe",
    "linux-arch",
  ]);
});

test("rejects unsupported files and download URLs outside the project release", () => {
  const release = parseLatestRelease({
    tag_name: "v1.0.0",
    assets: [
      {
        name: "Radyjko.aab",
        browser_download_url: "https://github.com/Mord0reK/Radyjko/releases/download/v1.0.0/Radyjko.aab",
        size: 10,
      },
      {
        name: "Radyjko.apk",
        browser_download_url: "https://example.com/Radyjko.apk",
        size: 10,
      },
    ],
  });

  assert.deepEqual(release.assets, []);
});

test("formats release asset sizes", () => {
  assert.equal(formatFileSize(1024), "1 KB");
  assert.equal(formatFileSize(5 * 1024 * 1024), "5.0 MB");
});
