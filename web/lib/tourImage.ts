export function resolveTourImageSrc(image: string) {
  const value = String(image || "").trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  if (value.startsWith("tours/")) return `/${value}`;
  return `/tours/${value}`;
}
