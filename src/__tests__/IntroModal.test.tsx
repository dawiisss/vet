/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IntroModal } from "../renderer/src/shared/components/IntroModal";
import { setupMockedApis, resetMockedApis, configApi } from "./rendererHelpers";

describe("IntroModal", () => {
  const onClose = jest.fn();

  setupMockedApis();

  beforeEach(() => {
    onClose.mockClear();
    resetMockedApis();
  });

  it("renders the first slide by default", () => {
    render(<IntroModal onClose={onClose} />);

    expect(screen.getByText("Welcome to Vet")).toBeInTheDocument();
    expect(screen.getByText("Very Easy Terminal")).toBeInTheDocument();
    expect(screen.getByText(/initializing session/i)).toBeInTheDocument();
  });

  it("navigates through slides with Next and Back buttons", () => {
    render(<IntroModal onClose={onClose} />);

    // Click Next to Slide 2 (Splits)
    const nextBtn = screen.getByText("Next \u2192");
    fireEvent.click(nextBtn);
    expect(screen.getByText("Multi-Pane Split & Persistence")).toBeInTheDocument();

    // Click Next to Slide 3 (Browser)
    fireEvent.click(nextBtn);
    expect(screen.getByText("Built-in Web Browser")).toBeInTheDocument();

    // Click Back to Slide 2
    const backBtn = screen.getByText("\u2190 Back");
    fireEvent.click(backBtn);
    expect(screen.getByText("Multi-Pane Split & Persistence")).toBeInTheDocument();
  });

  it("calls onClose and updates config when Skip is clicked", async () => {
    render(<IntroModal onClose={onClose} />);

    const skipBtn = screen.getByText("Skip");
    fireEvent.click(skipBtn);

    // It should update the config and close the modal
    expect(configApi.set).toHaveBeenCalledWith(
      expect.objectContaining({ showIntroOnStartup: false })
    );
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("allows selecting a theme and completes onboarding on the last slide", async () => {
    render(<IntroModal onClose={onClose} />);

    // Navigate to the last slide (Slide 9 - "Ready to Roll!")
    const nextBtn = screen.getByText("Next \u2192");
    for (let i = 0; i < 8; i++) {
      fireEvent.click(nextBtn);
    }

    expect(screen.getByText("Ready to Roll!")).toBeInTheDocument();

    // Click on a theme chip, e.g. Dracula
    const draculaBtn = screen.getByRole("button", { name: /dracula/i });
    fireEvent.click(draculaBtn);

    // Verify it updates the theme in config
    expect(configApi.set).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "dracula" })
    );

    // Click "Get Started" to complete onboarding
    const finishBtn = screen.getByRole("button", { name: "Get Started" });
    fireEvent.click(finishBtn);

    expect(configApi.set).toHaveBeenCalledWith(
      expect.objectContaining({ showIntroOnStartup: false })
    );
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
