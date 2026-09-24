export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const target = new URL("../" + specifier.slice(2), import.meta.url).href;
    return defaultResolve(target, context, defaultResolve);
  }
  return defaultResolve(specifier, context, defaultResolve);
}
