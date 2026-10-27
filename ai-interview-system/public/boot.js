/* Fieldwork startup guard: prevent an unavailable API from leaving the page on its loading screen. */
(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input && input.url;
    if (!url || !url.includes("/api/state")) return originalFetch(input, init);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    const options = { ...init, signal: controller.signal };
    return originalFetch(input, options).finally(() => window.clearTimeout(timeout));
  };

  window.addEventListener("error", (event) => {
    const root = document.getElementById("app");
    if (!root || !root.querySelector(".loading")) return;
    root.innerHTML = '<section class="startup-error"><h2>Fieldwork could not start</h2><p>The app encountered a startup error. Please reload the page. If this keeps happening, open the browser console and share the error message.</p><button type="button" onclick="location.reload()">Reload Fieldwork</button></section>';
  });

  window.setTimeout(() => {
    const root = document.getElementById("app");
    if (!root || !root.querySelector(".loading")) return;
    root.innerHTML = '<section class="startup-error"><h2>Fieldwork is taking too long to load</h2><p>Your saved browser data has not been intentionally cleared. Reload to try again. If this message returns, check the Render service logs for startup or API errors.</p><button type="button" onclick="location.reload()">Try again</button></section>';
  }, 12000);
})();