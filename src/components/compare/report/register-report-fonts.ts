import { Font } from "@react-pdf/renderer";

let registered = false;

export function registerReportFonts(): void {
  if (registered) return;
  Font.register({
    family: "Inter",
    src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-400-normal.woff",
  });
  Font.register({
    family: "Inter-SemiBold",
    src: "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-600-normal.woff",
  });
  registered = true;
}
