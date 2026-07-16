import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../api/jobs", () => ({
  listJobTypes: vi.fn(),
  getJobHistory: vi.fn(),
  triggerJob: vi.fn(),
  getIngestionStatus: vi.fn(),
}));
vi.mock("../../api/workspace", () => ({
  listAccounts: vi.fn(),
}));

const useAuthMock = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

const useIngestionStatusMock = vi.fn();
vi.mock("../../context/IngestionStatusContext", () => ({
  useIngestionStatus: () => useIngestionStatusMock(),
}));

import IngestionPage, { flattenCurRuns, summarizeRunResult } from "./IngestionPage";
import * as jobsApi from "../../api/jobs";

function setIngestion({ statuses = [], accounts = [], loading = false } = {}) {
  useIngestionStatusMock.mockReturnValue({
    statuses,
    accounts,
    loading,
    error: null,
    lastFetchedAt: new Date(),
    refresh: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <IngestionPage />
    </MemoryRouter>
  );
}

const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  useAuthMock.mockReturnValue({ user: { id: "u1", role: "viewer" } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("summarizeRunResult", () => {
  it("phrases success with row and account counts", () => {
    expect(
      summarizeRunResult({ status: "success", totalRows: 1234, accountCount: 1, failedAccounts: 0 })
    ).toMatch(/Run succeeded.*1,234 rows.*1 account\b/i);
  });
  it("phrases failure", () => {
    expect(
      summarizeRunResult({ status: "failure", totalRows: 0, accountCount: 1, failedAccounts: 1 })
    ).toMatch(/Run failed/i);
  });
  it("phrases skipped when no accounts are eligible", () => {
    expect(
      summarizeRunResult({ status: "skipped", totalRows: 0, accountCount: 0, failedAccounts: 0 })
    ).toMatch(/skipped/i);
  });
  it("phrases partial with failed-account count", () => {
    expect(
      summarizeRunResult({ status: "partial", totalRows: 100, accountCount: 3, failedAccounts: 1 })
    ).toMatch(/partially succeeded.*100 rows.*1 account/i);
  });
});

describe("flattenCurRuns", () => {
  it("filters out non-CUR jobs", () => {
    const rows = flattenCurRuns([
      {
        id: "r1",
        job_type: "cost_explorer_ingestion",
        status: "success",
        started_at: oneHourAgo,
        account_results: [{ account_id: "111", status: "success", record_count: 10 }],
      },
      {
        id: "r2",
        job_type: "cur_ingestion",
        status: "success",
        started_at: oneHourAgo,
        account_results: [{ account_id: "222", status: "success", record_count: 42 }],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].runId).toBe("r2");
    expect(rows[0].accountId).toBe("222");
  });

  it("emits one row per account_result", () => {
    const rows = flattenCurRuns([
      {
        id: "r1",
        job_type: "cur_ingestion",
        status: "success",
        started_at: oneHourAgo,
        account_results: [
          { account_id: "111", status: "success", record_count: 10 },
          { account_id: "222", status: "failed", record_count: 0, error_details: "boom" },
        ],
      },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].accountId).toBe("111");
    expect(rows[0].recordCount).toBe(10);
    expect(rows[1].accountId).toBe("222");
    expect(rows[1].status).toBe("failed");
    expect(rows[1].errorDetails).toBe("boom");
  });

  it("emits a single row with null account when account_results is empty", () => {
    const rows = flattenCurRuns([
      {
        id: "r1",
        job_type: "cur_ingestion",
        status: "skipped",
        started_at: oneHourAgo,
        account_results: [],
        error_details: null,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].accountId).toBeNull();
    expect(rows[0].recordCount).toBeNull();
    expect(rows[0].status).toBe("skipped");
  });
});

describe("IngestionPage", () => {
  it("renders empty state with CTA when no accounts are configured", async () => {
    setIngestion({ accounts: [], statuses: [] });
    jobsApi.getJobHistory.mockResolvedValue({ runs: [] });

    renderPage();
    expect(await screen.findByText(/No AWS accounts connected/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Go to Integrations/i })).toHaveAttribute(
      "href",
      "/settings?tab=integrations"
    );
  });

  it("shows the run-now primary action with admin gating for non-admins", async () => {
    setIngestion({ accounts: [{ aws_account_id: "333", alias: "QA" }], statuses: [] });
    jobsApi.getJobHistory.mockResolvedValue({ runs: [] });

    renderPage();
    const btn = await screen.findByRole("button", { name: /Run CUR ingestion now/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/Admin only/i)).toBeInTheDocument();
  });

  it("enables the run-now button for admins and calls triggerJob", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "admin" } });
    setIngestion({ accounts: [{ aws_account_id: "444", alias: "Prod" }], statuses: [] });
    jobsApi.getJobHistory.mockResolvedValue({ runs: [] });
    jobsApi.triggerJob.mockResolvedValue({
      job_run_id: "run-1",
      job_type: "cur_ingestion",
      status: "running",
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    const btn = await screen.findByRole("button", { name: /Run CUR ingestion now/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    await waitFor(() => expect(jobsApi.triggerJob).toHaveBeenCalledWith("cur_ingestion"));

    confirmSpy.mockRestore();
  });

  it("shows a success feedback summary after a synchronous successful run", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "admin" } });
    setIngestion({ accounts: [{ aws_account_id: "555", alias: "Prod" }], statuses: [] });
    const successRun = {
      id: "run-ok",
      workspace_id: "ws1",
      job_type: "cur_ingestion",
      status: "success",
      started_at: tenMinAgo,
      finished_at: tenMinAgo,
      error_details: null,
      account_results: [
        { account_id: "555", status: "success", record_count: 1234, error_details: null },
      ],
    };
    jobsApi.getJobHistory
      .mockResolvedValueOnce({ runs: [] })
      .mockResolvedValue({ runs: [successRun] });
    jobsApi.triggerJob.mockResolvedValue({
      job_run_id: "run-ok",
      job_type: "cur_ingestion",
      status: "success",
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    const btn = await screen.findByRole("button", { name: /Run CUR ingestion now/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Run succeeded/i)
    );
    expect(screen.getByRole("status")).toHaveTextContent(/1,234 rows/);
    confirmSpy.mockRestore();
  });

  it("shows a failure feedback summary when the synchronous run fails", async () => {
    useAuthMock.mockReturnValue({ user: { id: "u1", role: "admin" } });
    setIngestion({ accounts: [{ aws_account_id: "666", alias: "Prod" }], statuses: [] });
    const failedRun = {
      id: "run-fail",
      workspace_id: "ws1",
      job_type: "cur_ingestion",
      status: "failure",
      started_at: tenMinAgo,
      finished_at: tenMinAgo,
      error_details: null,
      account_results: [
        {
          account_id: "666",
          status: "failure",
          record_count: 0,
          error_details: "STS AssumeRole failed",
        },
      ],
    };
    jobsApi.getJobHistory
      .mockResolvedValueOnce({ runs: [] })
      .mockResolvedValue({ runs: [failedRun] });
    jobsApi.triggerJob.mockResolvedValue({
      job_run_id: "run-fail",
      job_type: "cur_ingestion",
      status: "failure",
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage();
    const btn = await screen.findByRole("button", { name: /Run CUR ingestion now/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/Run failed/i)
    );
    confirmSpy.mockRestore();
  });

  it("renders flattened CUR runs with per-account rows", async () => {
    setIngestion({
      accounts: [
        { aws_account_id: "555", alias: "Stage" },
        { aws_account_id: "666", alias: "Prod" },
      ],
      statuses: [],
    });
    jobsApi.getJobHistory.mockResolvedValue({
      runs: [
        {
          id: "run-1",
          workspace_id: "ws1",
          job_type: "cur_ingestion",
          status: "success",
          started_at: oneHourAgo,
          finished_at: tenMinAgo,
          error_details: null,
          account_results: [
            { account_id: "555", status: "success", record_count: 42, error_details: null },
            { account_id: "666", status: "success", record_count: 99, error_details: null },
          ],
        },
      ],
    });

    renderPage();
    expect(await screen.findByText("Stage")).toBeInTheDocument();
    expect(screen.getByText("Prod")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("99")).toBeInTheDocument();
  });

  it("filters out non-CUR job runs", async () => {
    setIngestion({ accounts: [{ aws_account_id: "777", alias: "QA" }], statuses: [] });
    jobsApi.getJobHistory.mockResolvedValue({
      runs: [
        {
          id: "r-ce",
          workspace_id: "ws1",
          job_type: "cost_explorer_ingestion",
          status: "success",
          started_at: oneHourAgo,
          finished_at: tenMinAgo,
          error_details: null,
          account_results: [
            { account_id: "777", status: "success", record_count: 1000, error_details: null },
          ],
        },
      ],
    });

    renderPage();
    expect(await screen.findByText(/No CUR ingestion runs yet/i)).toBeInTheDocument();
  });

  it("exposes error details on expandable row", async () => {
    setIngestion({ accounts: [{ aws_account_id: "888", alias: "Dev" }], statuses: [] });
    jobsApi.getJobHistory.mockResolvedValue({
      runs: [
        {
          id: "r-err",
          workspace_id: "ws1",
          job_type: "cur_ingestion",
          status: "failed",
          started_at: tenMinAgo,
          finished_at: tenMinAgo,
          error_details: null,
          account_results: [
            {
              account_id: "888",
              status: "failed",
              record_count: 0,
              error_details: "AccessDenied: cannot read s3://acme-cur/",
            },
          ],
        },
      ],
    });

    renderPage();
    const showBtn = await screen.findByRole("button", { name: /Show error/i });
    fireEvent.click(showBtn);
    expect(screen.getByText(/AccessDenied: cannot read/i)).toBeInTheDocument();
  });
});
