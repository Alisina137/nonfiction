/** PDFs are analyzed transiently and their raw bytes are discarded after indexing. */
export const RESOURCE_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const RESOURCE_NON_PDF_MAX_BYTES = 4 * 1024 * 1024;

/** Lowercase extensions (no dot) allowed in Resources uploads. */
export const ALLOWED_RESOURCE_EXTENSIONS = ["pdf", "doc", "docx", "md", "txt"];

const EXTENSION_MIME = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown",
  txt: "text/plain"
};

export function guessExtension(filename) {
  const i = filename.lastIndexOf(".");
  if (i === -1) return "";
  return filename.slice(i + 1).toLowerCase();
}

export function isAllowedResourceExtension(ext) {
  return ALLOWED_RESOURCE_EXTENSIONS.includes((ext || "").toLowerCase().replace(/^\./, ""));
}

export function mimeForExtension(ext) {
  const e = ext.toLowerCase().replace(/^\./, "");
  return EXTENSION_MIME[e] || "application/octet-stream";
}

export function bytesToLabel(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function parseResourceUploadFile(file) {
  const ext = guessExtension(file.name);
  return new Promise((resolve, reject) => {
    if (!file || !file.name) {
      reject(new Error("Missing file."));
      return;
    }
    if (!isAllowedResourceExtension(ext)) {
      reject(new Error(`Not allowed: .${ext}. Use ${ALLOWED_RESOURCE_EXTENSIONS.join(", ")}.`));
      return;
    }
    const maxBytes = ext === "pdf" ? RESOURCE_FILE_MAX_BYTES : RESOURCE_NON_PDF_MAX_BYTES;
    if (file.size > maxBytes) {
      reject(new Error(`"${file.name}" is too large (max ${bytesToLabel(maxBytes)} for .${ext}).`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read "${file.name}".`));

    if (ext === "md" || ext === "txt") {
      reader.onload = () => {
        resolve({
          originalName: file.name,
          extension: ext,
          mimeType: mimeForExtension(ext),
          sizeBytes: file.size,
          encoding: "text",
          textContent: typeof reader.result === "string" ? reader.result : ""
        });
      };
      reader.readAsText(file, "UTF-8");
      return;
    }

    reader.onload = () => {
      resolve({
        originalName: file.name,
        extension: ext,
        mimeType: file.type || mimeForExtension(ext),
        sizeBytes: file.size,
        encoding: "base64",
        dataBase64: bufferToBase64(reader.result)
      });
    };
    reader.readAsArrayBuffer(file);
  });
}
