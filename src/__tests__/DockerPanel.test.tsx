/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { jest } from "@jest/globals";
import DockerPanel from "../renderer/src/features/connections/components/DockerPanel";
import { setupMockedApis, resetMockedApis, connectionsApi } from "./rendererHelpers";

describe("DockerPanel", () => {
  beforeEach(() => {
    resetMockedApis();
    setupMockedApis();
  });

  it("renders container list and triggers actions", async () => {
    const mockContainers = [
      {
        id: "abc123",
        name: "my-web-app",
        image: "nginx:latest",
        state: "running" as const,
        status: "Up 2 hours",
        ports: "0.0.0.0:8080->80/tcp",
        created: "2 hours ago",
      },
      {
        id: "def456",
        name: "my-database",
        image: "postgres:15",
        state: "exited" as const,
        status: "Exited (0) 10 mins ago",
        ports: "",
        created: "1 day ago",
      },
    ];

    (connectionsApi.getDockerDetailed as any).mockResolvedValue(mockContainers);
    const onRunScript = jest.fn();

    render(<DockerPanel isActive={true} onRunScript={onRunScript} />);

    await waitFor(() => {
      expect(screen.getByText("my-web-app")).toBeInTheDocument();
      expect(screen.getByText("my-database")).toBeInTheDocument();
    });

    // Check port link exists
    expect(screen.getByText(":8080")).toBeInTheDocument();

    // Click Exec Shell '💻' on running container
    const execBtn = screen.getByTitle("Exec Shell");
    fireEvent.click(execBtn);

    expect(onRunScript).toHaveBeenCalledWith("docker exec -it my-web-app /bin/bash", "");

    // Click Stop Container '⏹'
    const stopBtn = screen.getByTitle("Stop Container");
    fireEvent.click(stopBtn);

    expect(connectionsApi.dockerAction).toHaveBeenCalledWith("my-web-app", "stop");
  });

  it("switches to images subtab and renders images", async () => {
    const mockImages = [
      {
        id: "img1",
        repository: "node",
        tag: "20-alpine",
        size: "180MB",
        created: "3 days ago",
      },
    ];

    (connectionsApi.getDockerImages as any).mockResolvedValue(mockImages);

    render(<DockerPanel isActive={true} onRunScript={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Images/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Images/i }));

    await waitFor(() => {
      expect(screen.getByText("node")).toBeInTheDocument();
      expect(screen.getByText("20-alpine")).toBeInTheDocument();
      expect(screen.getByText("180MB")).toBeInTheDocument();
    });
  });
});
