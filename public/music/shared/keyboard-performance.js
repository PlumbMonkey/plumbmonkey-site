(() => {
  const editable = (target) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName));

  const dispatchPointer = (element, type) => {
    if (!element) return;
    element.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        buttons: type === "pointerdown" ? 1 : 0,
      }),
    );
  };

  const addHint = (text) => {
    if (document.querySelector(".pm-keyboard-hint")) return;
    const hint = document.createElement("p");
    hint.className = "pm-keyboard-hint";
    hint.textContent = text;
    hint.setAttribute("aria-live", "polite");
    document.body.appendChild(hint);
  };

  const styles = document.createElement("style");
  styles.textContent = `
    .pm-sandbox-nav {
      position: relative; z-index: 100; display: flex; flex-wrap: wrap;
      justify-content: center; gap: .55rem; padding: .7rem 1rem;
      background: #15121a; border-bottom: 1px solid #3c3243;
      font: 700 .72rem/1.2 system-ui, sans-serif;
      letter-spacing: .08em; text-transform: uppercase;
    }
    .pm-sandbox-nav a {
      padding: .55rem .75rem; color: #eee7d8; text-decoration: none;
      border: 1px solid #55465d; border-radius: 999px;
    }
    .pm-sandbox-nav a:hover, .pm-sandbox-nav a:focus-visible {
      color: #171119; background: #c3dfb8; border-color: #c3dfb8;
      outline: none;
    }
    .pm-sandbox-nav + #root .app-shell {
      height: calc(100vh - 3.25rem);
    }
    .pm-keyboard-hint {
      position: relative; z-index: 20; margin: 0; padding: .65rem 1rem;
      color: #d9c8aa; background: #15121a; border-top: 1px solid #3c3243;
      font: 600 .75rem/1.4 system-ui, sans-serif; text-align: center;
    }
  `;
  document.head.appendChild(styles);

  const synthCodes = [
    "KeyA", "KeyW", "KeyS", "KeyE", "KeyD", "KeyF",
    "KeyT", "KeyG", "KeyY", "KeyH", "KeyU", "KeyJ", "KeyK",
  ];
  const drumCodes = [
    "Digit1", "Digit2", "Digit3", "Digit4",
    "Digit5", "Digit6", "Digit7", "Digit8",
  ];
  const pressed = new Map();

  const synthKeys = () => {
    const modern = [...document.querySelectorAll(".keyboard button")];
    if (modern.length) return modern;

    const candidates = [
      ...document.querySelectorAll(
        '[class*="keyboard"] button, [class*="piano"] button, button[class*="key"]',
      ),
    ];
    return candidates.filter((button) => {
      const label = button.getAttribute("aria-label") || button.textContent || "";
      return /(?:play\s+)?[A-G](?:#|b)?\d?/i.test(label.trim());
    });
  };

  const drumPads = () => [
    ...document.querySelectorAll(".dm-pad, [data-drum-pad]"),
  ].slice(0, 8);

  const isDrumMachine =
    document.documentElement.dataset.instrument === "dm2" ||
    location.pathname.includes("drum-machine");

  window.addEventListener("keydown", (event) => {
    if (event.repeat || editable(event.target)) return;
    const codes = isDrumMachine ? drumCodes : synthCodes;
    const index = codes.indexOf(event.code);
    if (index < 0) return;

    const controls = isDrumMachine ? drumPads() : synthKeys();
    const control = controls[index];
    if (!control) return;

    event.preventDefault();
    if (isDrumMachine) {
      control.click();
    } else {
      dispatchPointer(control, "pointerdown");
      pressed.set(event.code, control);
    }
  });

  window.addEventListener("keyup", (event) => {
    const control = pressed.get(event.code);
    if (!control) return;
    event.preventDefault();
    dispatchPointer(control, "pointerup");
    pressed.delete(event.code);
  });

  window.addEventListener("blur", () => {
    pressed.forEach((control) => dispatchPointer(control, "pointerup"));
    pressed.clear();
  });

  const describeKeys = () => {
    if (location.pathname.includes("drum-machine")) return;
    const text = isDrumMachine
      ? "Computer keyboard: use 1–8 to play the eight drum pads."
      : "Computer keyboard: use A W S E D F T G Y H U J K to play notes.";
    addHint(text);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", describeKeys, { once: true });
  } else {
    describeKeys();
  }
})();
