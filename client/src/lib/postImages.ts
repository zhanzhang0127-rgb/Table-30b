const KNOWN_MISSING_IMAGE_URLS = new Set([
  "https://example.com/a.jpg",
  "http://example.com/a.jpg",
]);

export function readPostImageUrls(images: unknown): string[] {
  if (!images) return [];

  if (Array.isArray(images)) {
    return images
      .filter((image): image is string => typeof image === "string")
      .map((image) => image.trim())
      .filter(Boolean);
  }

  if (typeof images !== "string") return [];

  const trimmed = images.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return readPostImageUrls(parsed);
  } catch {
    return [trimmed];
  }
}

export function parsePostImages(images: unknown): string[] {
  return readPostImageUrls(images).filter(
    (image) => !KNOWN_MISSING_IMAGE_URLS.has(image)
  );
}

export function hasMissingPostImages(images: unknown): boolean {
  return readPostImageUrls(images).some((image) =>
    KNOWN_MISSING_IMAGE_URLS.has(image)
  );
}
