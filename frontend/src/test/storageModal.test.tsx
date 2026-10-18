import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LocalStorageModal } from "../components/LocalStorageModal";
import * as storage from "../lib/storage";

describe("LocalStorageModal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders storage summary and privacy guarantee", () => {
    vi.spyOn(storage, "getStorageSummary").mockReturnValue({
      hasSavedLedger: true,
      savedLedgerName: "october_invoices.csv",
      invoiceCount: 15,
      nudgeCount: 4,
      approximateBytes: 8192,
      businessName: "Acme Agency",
    });

    render(
      <LocalStorageModal
        isOpen={true}
        onClose={vi.fn()}
        onDataChanged={vi.fn()}
      />
    );

    expect(screen.getByText(/Browser Storage & Privacy/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero-Cloud Data Retention Guarantee/i)).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("october_invoices.csv")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("8.0 KB")).toBeInTheDocument();
  });

  it("updates and persists the freelancer business name", async () => {
    const mockDataChanged = vi.fn();
    const saveProfileSpy = vi.spyOn(storage, "saveUserProfile");

    render(
      <LocalStorageModal
        isOpen={true}
        onClose={vi.fn()}
        onDataChanged={mockDataChanged}
      />
    );

    const input = screen.getByPlaceholderText(/e\.g\. Acme Design Studio/i);
    fireEvent.change(input, { target: { value: "Studio Velocity" } });

    const saveBtn = screen.getByRole("button", { name: /^Save$/i });
    fireEvent.click(saveBtn);

    expect(saveProfileSpy).toHaveBeenCalledWith({ businessName: "Studio Velocity" });
    expect(mockDataChanged).toHaveBeenCalled();
    expect(await screen.findByText(/^Saved$/i)).toBeInTheDocument();
  });

  it("triggers JSON backup export when Export Backup is clicked", () => {
    const exportSpy = vi.spyOn(storage, "exportLocalBackup").mockReturnValue('{"version":"1.0"}');
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <LocalStorageModal
        isOpen={true}
        onClose={vi.fn()}
        onDataChanged={vi.fn()}
      />
    );

    const exportBtn = screen.getByRole("button", { name: /Export Backup \(JSON\)/i });
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalled();
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
  });

  it("shows confirmation and clears all local data when confirmed", async () => {
    const clearSpy = vi.spyOn(storage, "clearAllLocalData");
    const mockClose = vi.fn();
    const mockDataChanged = vi.fn();

    render(
      <LocalStorageModal
        isOpen={true}
        onClose={mockClose}
        onDataChanged={mockDataChanged}
      />
    );

    // Click "Clear All Saved Browser Data"
    const openClearBtn = screen.getByRole("button", { name: /Clear All Saved Browser Data/i });
    fireEvent.click(openClearBtn);

    // Confirmation dialog appears
    expect(screen.getByText(/Are you sure you want to clear all local data\?/i)).toBeInTheDocument();

    // Confirm
    const confirmBtn = screen.getByRole("button", { name: /Yes, Clear Everything/i });
    fireEvent.click(confirmBtn);

    expect(clearSpy).toHaveBeenCalled();
    expect(mockDataChanged).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });
});
