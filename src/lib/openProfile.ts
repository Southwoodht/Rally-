/**
 * Open somebody's profile from anywhere, by account id (or league player id).
 *
 * Inside the app this hands the id to RallyApp, which opens their profile in
 * place — no page load. It used to set window.location to "/?profile=…",
 * which reloaded the whole app: Sam saw the start page flash up before the
 * profile, "like Internet Explorer". Outside the app (the /search and
 * /players pages, where RallyApp is not mounted) there is no handler, and the
 * old link is still the right thing.
 */
let handler: ((id: string) => void) | null = null;

export function setProfileOpener(fn: ((id: string) => void) | null): void {
  handler = fn;
}

export function openProfile(id: string): void {
  if (handler) { handler(id); return; }
  if (typeof window !== "undefined") window.location.href = "/?profile=" + encodeURIComponent(id);
}
