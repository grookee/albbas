const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/x-png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/x-icon": ".ico",
  "image/tiff": ".tiff",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "text/markdown": ".md",
  "application/pdf": ".pdf",
  "application/json": ".json",
  "application/javascript": ".js",
  "application/xml": ".xml",
  "application/zip": ".zip",
  "application/gzip": ".gz",
  "application/x-tar": ".tar",
  "application/x-7z-compressed": ".7z",
  "application/vnd.rar": ".rar",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
};

export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  const known = MIME_EXTENSIONS[normalized];
  if (known) return known;

  const [family, subtype] = normalized.split("/");
  if (
    family === "image" ||
    family === "video" ||
    family === "audio" ||
    family === "text"
  ) {
    if (subtype && /^[a-z0-9]+$/.test(subtype)) return `.${subtype}`;
  }

  return "";
}
