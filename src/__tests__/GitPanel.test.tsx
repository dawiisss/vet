/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { jest } from "@jest/globals";
import GitPanel from "../renderer/src/shared/components/GitPanel";
import { setupMockedApis, resetMockedApis, workspaceApi } from "./rendererHelpers";

describe("GitPanel", () => {
  beforeEach(() => {
    resetMockedApis();
    setupMockedApis();
  });

  it("renders non-git empty state when not in a git repository", async () => {
    (workspaceApi.getGitDetailedStatus as any).mockResolvedValue({
      isGit: false,
      repoRoot: "",
      branch: "",
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
    });

    render(<GitPanel isActive={true} activeTerminalId="term-1" />);

    await waitFor(() => {
      expect(screen.getByText("No Git Repository")).toBeInTheDocument();
    });
  });

  it("renders branch, staged changes, and unstaged changes", async () => {
    (workspaceApi.getGitDetailedStatus as any).mockResolvedValue({
      isGit: true,
      repoRoot: "/home/user/projects",
      branch: "main",
      ahead: 1,
      behind: 0,
      staged: [{ path: "src/staged.ts", status: "M" }],
      unstaged: [{ path: "src/unstaged.ts", status: "M" }],
      untracked: [{ path: "newfile.txt" }],
    });
    (workspaceApi.getGitBranches as any).mockResolvedValue({
      current: "main",
      all: ["main", "feature"],
    });

    render(<GitPanel isActive={true} activeTerminalId="term-1" />);

    await waitFor(() => {
      expect(screen.getByText("main")).toBeInTheDocument();
      expect(screen.getByText("src/staged.ts")).toBeInTheDocument();
      expect(screen.getByText("src/unstaged.ts")).toBeInTheDocument();
      expect(screen.getByText("newfile.txt")).toBeInTheDocument();
    });
  });

  it("triggers gitStage and gitUnstage on user action", async () => {
    (workspaceApi.getGitDetailedStatus as any).mockResolvedValue({
      isGit: true,
      repoRoot: "/home/user/projects",
      branch: "main",
      ahead: 0,
      behind: 0,
      staged: [{ path: "src/staged.ts", status: "M" }],
      unstaged: [{ path: "src/unstaged.ts", status: "M" }],
      untracked: [],
    });

    render(<GitPanel isActive={true} activeTerminalId="term-1" />);

    await waitFor(() => {
      expect(screen.getByText("src/unstaged.ts")).toBeInTheDocument();
    });

    // Click Stage file '+'
    const stageButtons = screen.getAllByTitle("Stage file");
    fireEvent.click(stageButtons[0]!);

    expect(workspaceApi.gitStage).toHaveBeenCalledWith(
      expect.any(String),
      ["src/unstaged.ts"],
    );

    // Click Unstage file '-'
    const unstageButtons = screen.getAllByTitle("Unstage file");
    fireEvent.click(unstageButtons[0]!);

    expect(workspaceApi.gitUnstage).toHaveBeenCalledWith(
      expect.any(String),
      ["src/staged.ts"],
    );
  });

  it("commits staged changes with message", async () => {
    (workspaceApi.getGitDetailedStatus as any).mockResolvedValue({
      isGit: true,
      repoRoot: "/home/user/projects",
      branch: "main",
      ahead: 0,
      behind: 0,
      staged: [{ path: "src/staged.ts", status: "M" }],
      unstaged: [],
      untracked: [],
    });

    render(<GitPanel isActive={true} activeTerminalId="term-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Message (Ctrl+Enter to commit)")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Message (Ctrl+Enter to commit)");
    fireEvent.change(textarea, { target: { value: "feat: add awesome feature" } });

    const commitBtn = screen.getByRole("button", { name: /Commit \(1 staged\)/i });
    fireEvent.click(commitBtn);

    expect(workspaceApi.gitCommit).toHaveBeenCalledWith(
      expect.any(String),
      "feat: add awesome feature",
    );
  });
});
