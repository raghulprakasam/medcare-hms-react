import { useEffect } from "react";

/**
 * Injects raw CSS text into a <style> tag for the lifetime of the
 * component, then removes it on unmount.
 *
 * WHY: the original project was five separate static HTML pages, each
 * with its own <style> block, so class names like `.btn`, `.card`,
 * `.modal` were free to mean different things on each page. Converting
 * to a single-page React app means all CSS would otherwise become
 * global at once and those class names would collide. Scoping each
 * page's stylesheet to "only active while this page is mounted"
 * reproduces the original isolation exactly, with zero rewriting of
 * selectors (and therefore zero risk of visually breaking the
 * pixel-perfect designs that were converted).
 */
export default function usePageStyles(cssText, id) {
  useEffect(() => {
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-page-style", id);
    styleEl.textContent = cssText;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, [cssText, id]);
}
