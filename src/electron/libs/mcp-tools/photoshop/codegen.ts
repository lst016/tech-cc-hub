import type {
  PhotoshopCodeGenerationResult,
  PhotoshopComponentManifest,
  PhotoshopSectionManifest,
  PhotoshopWebManifest,
} from "./types.js";

function classNameFromId(id: string): string {
  return id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function componentText(component: PhotoshopComponentManifest): string {
  return component.text?.trim() || component.type;
}

function renderNativeComponent(component: PhotoshopComponentManifest): string {
  const className = classNameFromId(component.id);
  if (component.type === "button") {
    return `      <button class="component ${className}" type="button">${escapeHtml(componentText(component))}</button>`;
  }
  if (component.type === "text") {
    return `      <p class="component ${className}">${escapeHtml(componentText(component))}</p>`;
  }
  if (component.type === "asset") {
    return `      <div class="component ${className}" role="img" aria-label="${escapeHtml(component.id)}"></div>`;
  }
  return `      <div class="component ${className}">${escapeHtml(componentText(component))}</div>`;
}

function renderSection(section: PhotoshopSectionManifest): string {
  const className = classNameFromId(section.id);
  const review = section.needsReview ? " data-needs-review=\"true\"" : "";
  const components = section.components.map(renderNativeComponent).join("\n") || "      <div class=\"section-placeholder\"></div>";
  return [
    `    <section class="page-section ${className}"${review}>`,
    `      <div class="section-inner">`,
    `        <h2>${escapeHtml(section.name)}</h2>`,
    components,
    "      </div>",
    "    </section>",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssForSection(section: PhotoshopSectionManifest): string {
  const className = classNameFromId(section.id);
  const minHeight = Math.max(160, Math.round(section.bounds.height));
  return [
    `.${className} {`,
    `  min-height: ${minHeight}px;`,
    `}`,
  ].join("\n");
}

export function generateNativeWebProject(manifest: PhotoshopWebManifest): PhotoshopCodeGenerationResult {
  const html = [
    "<!doctype html>",
    "<html lang=\"en\">",
    "  <head>",
    "    <meta charset=\"utf-8\">",
    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `    <title>${escapeHtml(manifest.page.name)}</title>`,
    "    <link rel=\"stylesheet\" href=\"styles.css\">",
    "  </head>",
    "  <body>",
    "    <main class=\"page\">",
    manifest.page.sections.map(renderSection).join("\n"),
    "    </main>",
    "    <script src=\"main.js\" type=\"module\"></script>",
    "  </body>",
    "</html>",
    "",
  ].join("\n");

  const css = [
    ":root {",
    "  --page-max-width: 1440px;",
    "  --color-text: #111827;",
    "  --color-surface: #ffffff;",
    "  --color-accent: #2563eb;",
    "}",
    "",
    "* { box-sizing: border-box; }",
    "body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; color: var(--color-text); background: var(--color-surface); }",
    ".page { width: 100%; }",
    ".page-section { display: flex; justify-content: center; padding: 48px 24px; }",
    ".section-inner { width: min(100%, var(--page-max-width)); }",
    ".component { margin-top: 16px; }",
    ".component button, button.component { min-height: 44px; border: 0; border-radius: 8px; padding: 0 18px; background: var(--color-accent); color: #fff; font: inherit; }",
    ".section-placeholder { min-height: 80px; border: 1px dashed rgba(17, 24, 39, 0.2); }",
    "",
    manifest.page.sections.map(cssForSection).join("\n\n"),
    "",
  ].join("\n");

  const js = [
    "const reviewSections = document.querySelectorAll('[data-needs-review=\"true\"]');",
    "for (const section of reviewSections) {",
    "  section.dataset.reviewReason = 'Low-confidence PSD inference; verify against the original design.';",
    "}",
    "",
  ].join("\n");

  return {
    target: "html-css-js",
    files: [
      { path: "index.html", language: "html", content: html },
      { path: "styles.css", language: "css", content: css },
      { path: "main.js", language: "javascript", content: js },
      { path: "photoshop-manifest.json", language: "json", content: `${JSON.stringify(manifest, null, 2)}\n` },
    ],
    warnings: manifest.warnings,
  };
}

function reactComponentName(value: string): string {
  const parts = classNameFromId(value).split("-").filter(Boolean);
  const name = parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join("");
  return name || "PhotoshopPage";
}

function renderReactSection(section: PhotoshopSectionManifest): string {
  const componentName = reactComponentName(section.id);
  const components = section.components
    .map((component) => `        <div className="mt-4" data-ps-layer="${escapeHtml(component.sourceLayerId ?? component.id)}">${escapeHtml(componentText(component))}</div>`)
    .join("\n") || "        <div className=\"mt-4 min-h-20 border border-dashed border-slate-300\" />";
  return [
    `function ${componentName}() {`,
    "  return (",
    `    <section className="px-6 py-12" data-ps-section="${escapeHtml(section.id)}"${section.needsReview ? " data-needs-review=\"true\"" : ""}>`,
    "      <div className=\"mx-auto w-full max-w-[1440px]\">",
    `        <h2 className="text-2xl font-semibold">${escapeHtml(section.name)}</h2>`,
    components,
    "      </div>",
    "    </section>",
    "  );",
    "}",
  ].join("\n");
}

export function generateReactTailwindProject(manifest: PhotoshopWebManifest): PhotoshopCodeGenerationResult {
  const sectionComponents = manifest.page.sections.map(renderReactSection).join("\n\n");
  const sectionTags = manifest.page.sections
    .map((section) => `      <${reactComponentName(section.id)} />`)
    .join("\n");
  const app = [
    "import type { JSX } from \"react\";",
    "",
    sectionComponents,
    "",
    "export default function PhotoshopGeneratedPage(): JSX.Element {",
    "  return (",
    "    <main className=\"min-h-screen bg-white text-slate-950\">",
    sectionTags,
    "    </main>",
    "  );",
    "}",
    "",
  ].join("\n");

  const readme = [
    `# ${manifest.page.name} PSD Draft`,
    "",
    "Generated from a Photoshop manifest. Review low-confidence sections before treating this as production UI.",
    "",
    `- Sections: ${manifest.page.sections.length}`,
    `- Assets: ${manifest.assets.length}`,
    "- Target: React + Tailwind",
    "",
  ].join("\n");

  return {
    target: "react-tailwind",
    files: [
      { path: "PhotoshopGeneratedPage.tsx", language: "tsx", content: app },
      { path: "README.md", language: "markdown", content: readme },
      { path: "photoshop-manifest.json", language: "json", content: `${JSON.stringify(manifest, null, 2)}\n` },
    ],
    warnings: manifest.warnings,
  };
}
