/* Runs before the first paint (loaded without defer): switches on the JS-only start
   states in main.css, so animated elements do not flash before main.js takes over. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.add("js");
  if (reduce) root.classList.add("reduced");
  try {
    // The heartbeat intro plays once per browser session, and never when jumping to a section.
    if (!reduce && !location.hash && !sessionStorage.getItem("intro-seen")) root.classList.add("show-intro");
  } catch (e) {
    /* storage blocked: skip the intro */
  }
})();
