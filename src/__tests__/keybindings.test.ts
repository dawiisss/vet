import { buildShortcutString } from "../renderer/src/shared/utils/keybindings";

describe("buildShortcutString", () => {
  it("returns null when only modifier keys are pressed", () => {
    // Arrange
    const ctrlEvent = { key: "Control" } as KeyboardEvent;
    const shiftEvent = { key: "Shift" } as KeyboardEvent;
    const altEvent = { key: "Alt" } as KeyboardEvent;
    const metaEvent = { key: "Meta" } as KeyboardEvent;
    const ctrlLowerEvent = { key: "ctrl" } as KeyboardEvent;

    // Act
    const ctrlResult = buildShortcutString(ctrlEvent);
    const shiftResult = buildShortcutString(shiftEvent);
    const altResult = buildShortcutString(altEvent);
    const metaResult = buildShortcutString(metaEvent);
    const ctrlLowerResult = buildShortcutString(ctrlLowerEvent);

    // Assert
    expect(ctrlResult).toBeNull();
    expect(shiftResult).toBeNull();
    expect(altResult).toBeNull();
    expect(metaResult).toBeNull();
    expect(ctrlLowerResult).toBeNull();
  });

  it("normalizes single key without modifiers", () => {
    // Arrange
    const event = {
      key: "A",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    } as KeyboardEvent;

    // Act
    const result = buildShortcutString(event);

    // Assert
    expect(result).toBe("a");
  });

  it("includes ctrl modifier", () => {
    // Arrange
    const event = {
      key: "c",
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    } as KeyboardEvent;

    // Act
    const result = buildShortcutString(event);

    // Assert
    expect(result).toBe("ctrl+c");
  });

  it("includes all modifiers in the correct order: ctrl+alt+shift+meta+key", () => {
    // Arrange
    const event = {
      key: "t",
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
      metaKey: true,
    } as KeyboardEvent;

    // Act
    const result = buildShortcutString(event);

    // Assert
    expect(result).toBe("ctrl+alt+shift+meta+t");
  });

  it("handles other combinations of modifiers correctly", () => {
    // Arrange
    const ctrlShiftEvent = {
      key: "p",
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
      metaKey: false,
    } as KeyboardEvent;
    const metaAltEvent = {
      key: "Delete",
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      metaKey: true,
    } as KeyboardEvent;

    // Act
    const ctrlShiftResult = buildShortcutString(ctrlShiftEvent);
    const metaAltResult = buildShortcutString(metaAltEvent);

    // Assert
    expect(ctrlShiftResult).toBe("ctrl+shift+p");
    expect(metaAltResult).toBe("alt+meta+delete");
  });
});
