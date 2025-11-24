# codex-text-test
diff --git a/README.md b/README.md
index 4cf35cd84e66393ddbf6fd41307638627947b89e..e465df1b0d47aa0afd79aa41f9ceed36a7406dab 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,24 @@
-# codex-text-test
+# Superscribe Text Expander
+
+A full-page Chrome extension for managing rich-text snippets with Supabase sync and automatic expansion across any webpage.
+
+## Features
+- Visual editor (H1/H2, bold, italic, underline, strikethrough, links, lists, emoji) with real formatting instead of raw HTML.
+- Create, edit, delete, and duplicate snippets organized by folder, tags, and color labels.
+- Trigger snippets with custom keywords (e.g., `;sig`) and choose expansion keys (space, tab, or enter).
+- Works in inputs, textareas, and contenteditable surfaces to cover tools like Gmail, Docs, Notion, and WhatsApp Web.
+- Variable support: `{date}`, `{time}`, `{clipboard}`, `{name}`, and date math such as `{today+3}`.
+- Light/Dark theme, global search shortcut (Ctrl/Cmd + Space), analytics (usage counts and last used), and sync log.
+- Supabase integration for auth + sync plus manual JSON/CSV import/export with offline caching via Chrome storage.
+
+## Running locally
+1. Build assets (no build step required — static files only).
+2. Open Chrome → Extensions → Enable Developer Mode.
+3. Load Unpacked and select this folder. Click the extension icon to open the full-page dashboard.
+
+## Files
+- `manifest.json` — Chrome extension definition.
+- `dashboard.html`, `dashboard.css`, `dashboard.js` — Full-page UI and logic.
+- `background.js` — Opens the dashboard tab and tracks usage analytics.
+- `content-script.js` — Injected into all pages to expand triggers into snippet content.
+- `icon.png` — Extension icon placeholder.
