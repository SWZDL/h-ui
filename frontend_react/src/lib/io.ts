import type { AxiosResponse } from "axios";

/** Read the filename from `Content-Disposition`, falling back to a default. */
export function filenameFromResponse(
  response: AxiosResponse<Blob>,
  fallback: string
): string {
  const disposition =
    response.headers["content-disposition"] ??
    response.headers["Content-Disposition"] ??
    "";

  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(String(disposition));
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1].replace(/"/g, ""));
    } catch {
      return match[1].replace(/"/g, "");
    }
  }
  return fallback;
}

/** Trigger a browser download for a Blob response. */
export function downloadResponse(
  response: AxiosResponse<Blob>,
  fallbackName: string
) {
  const blob = new Blob([response.data], { type: "application/octet-stream" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFromResponse(response, fallbackName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

/** Reject files that are not the expected extension / are too large. */
export function validateFile(
  file: File,
  options: { extensions: string[]; maxSizeMb?: number }
): string | null {
  const name = file.name.toLowerCase();
  if (!options.extensions.some((extension) => name.endsWith(extension))) {
    return `Unsupported file type. Allowed: ${options.extensions.join(", ")}`;
  }
  const maxSize = options.maxSizeMb ?? 2;
  if (file.size / 1024 / 1024 > maxSize) {
    return `File is too large. Maximum size is ${maxSize} MB`;
  }
  return null;
}

/** Copy text to the clipboard with a fallback for insecure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}
