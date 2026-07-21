import { useEffect } from "react";

const LOCKED_BODY_PROPERTIES = [
  "overflow",
  "padding-right",
  "padding-left",
  "padding-top",
  "margin-right",
  "position",
] as const;

function applyScrollLockFix() {
  if (!document.body.hasAttribute("data-scroll-locked")) {
    for (const property of LOCKED_BODY_PROPERTIES) {
      document.body.style.removeProperty(property);
    }
    return;
  }

  document.body.style.setProperty("overflow", "auto", "important");
  document.body.style.setProperty("padding-right", "0px", "important");
  document.body.style.setProperty("padding-left", "0px", "important");
  document.body.style.setProperty("padding-top", "0px", "important");
  document.body.style.setProperty("margin-right", "0px", "important");
  document.body.style.setProperty("position", "static", "important");
}

/**
 * Radix Select uses react-remove-scroll, which locks body scroll and injects
 * compensating padding after our CSS loads — hiding the scrollbar and shifting
 * layout. Inline !important styles override that injected stylesheet.
 */
export function ScrollLockOverride() {
  useEffect(() => {
    const scheduleFix = () => {
      applyScrollLockFix();
      requestAnimationFrame(applyScrollLockFix);
    };

    scheduleFix();

    const observer = new MutationObserver(scheduleFix);

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked", "style", "class"],
    });

    if (document.head) {
      observer.observe(document.head, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      observer.disconnect();
      for (const property of LOCKED_BODY_PROPERTIES) {
        document.body.style.removeProperty(property);
      }
    };
  }, []);

  return null;
}
