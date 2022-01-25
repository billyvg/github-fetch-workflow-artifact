import * as io from "@actions/io";
import { getOctokit } from "@actions/github";
import * as exec from "@actions/exec";
import download from "./index";

jest.mock("path", () => ({
  resolve: () => "/",
  dirname: () => "/dirname",
  basename: () => "/basename",
}));

jest.mock("@actions/io", () => ({
  mkdirP: jest.fn(async () => Promise.resolve()),
}));
jest.mock("@actions/exec", () => ({
  exec: jest.fn(),
}));

test("downloads and extracts artifact", async function () {
  const octokit = getOctokit("token");

  const downloadResult = await download(octokit, {
    owner: "billyvg",
    repo: "sentry",
    artifactName: "visual-snapshots",
    workflowName: "workflowName",
    branch: "main",
    downloadPath: ".artifacts",
  });

  expect(octokit.rest.actions.listWorkflowRuns).toHaveBeenCalledWith({
    owner: "billyvg",
    repo: "sentry",
    workflow_id: 1234,
    branch: "main",
    per_page: 10,
    status: "success",
  });

  expect(octokit.rest.actions.listWorkflowRunArtifacts).toHaveBeenCalledWith({
    owner: "billyvg",
    repo: "sentry",
    run_id: 152081708,
  });

  expect(io.mkdirP).toHaveBeenCalledWith(".artifacts");
  expect(exec.exec).toHaveBeenCalledWith(
    "wget",
    expect.arrayContaining([
      "/",
      "https://pipelines.actions.githubusercontent.com/fVNRiR9dLg3DkWCpAUCEq7qRezdKTcYtICIqwx0vWs6L0oyqxQ/_apis/pipelines/1/runs/487/signedartifactscontent?artifactName=visual-snapshots&urlExpires=2020-06-30T00%3A19%3A19.8133132Z&urlSigningMethod=HMACV1&urlSignature=12tWt93zqyKS9Fy7IMRj1NGHxGn07YTDwOZT988hCAI%3D",
    ])
  );
  expect(exec.exec).toHaveBeenCalledWith(
    "unzip",
    ["-q", "-d", ".artifacts", "/"],
    {
      silent: true,
    }
  );

  expect(downloadResult).toEqual({
    artifact: {
      archive_download_url:
        "https://api.github.com/repos/billyvg/sentry/actions/artifacts/9808919/zip",
      created_at: "2020-06-29T23:56:36Z",
      expired: false,
      id: 9808919,
      name: "visual-snapshots",
      node_id: "MDg6QXJ0aWZhY3Q5ODA4OTE5",
      size_in_bytes: 11768446,
      updated_at: "2020-06-29T23:56:40Z",
      url: "https://api.github.com/repos/billyvg/sentry/actions/artifacts/9808919",
    },
    workflowRun: {
      artifacts_url:
        "https://api.github.com/repos/billyvg/sentry/actions/runs/152081708/artifacts",
      cancel_url:
        "https://api.github.com/repos/billyvg/sentry/actions/runs/152081708/cancel",
      check_suite_url:
        "https://api.github.com/repos/billyvg/sentry/check-suites/856201749",
      conclusion: "success",
      created_at: "2020-06-29T23:42:39Z",
      event: "push",
      head_branch: "master",
      head_commit: {
        author: { email: "billy@sentry.io", name: "Billy Vong" },
        committer: { email: "billy@sentry.io", name: "Billy Vong" },
        id: "5e19cbbea129a173dc79d4634df0fdaece933b06",
        message: "remove wait for animations",
        timestamp: "2020-06-29T23:42:25Z",
        tree_id: "332a699162888947ea062892169d9d81a9c906fe",
      },
      head_repository: {full_name: 'billyvg/sentry'},
      head_sha: "5e19cbbea129a173dc79d4634df0fdaece933b06",
      html_url: "https://github.com/billyvg/sentry/actions/runs/152081708",
      id: 152081708,
      jobs_url:
        "https://api.github.com/repos/billyvg/sentry/actions/runs/152081708/jobs",
      logs_url:
        "https://api.github.com/repos/billyvg/sentry/actions/runs/152081708/logs",
      node_id: "MDExOldvcmtmbG93UnVuMTUyMDgxNzA4",
      pull_requests: [],
      repository: {},
      rerun_url:
        "https://api.github.com/repos/billyvg/sentry/actions/runs/152081708/rerun",
      run_number: 172,
      status: "completed",
      updated_at: "2020-06-29T23:56:40Z",
      url: "https://api.github.com/repos/billyvg/sentry/actions/runs/152081708",
      workflow_id: 1154499,
      workflow_url:
        "https://api.github.com/repos/billyvg/sentry/actions/workflows/1154499",
    },
  });
});

test("downloads and extracts artifact from workflow from specific workflow event", async function () {
  const octokit = getOctokit("token");

  const downloadResult = await download(octokit, {
    owner: "billyvg",
    repo: "sentry",
    artifactName: "visual-snapshots",
    workflowName: "workflowName",
    branch: "main",
    downloadPath: ".artifacts",
    workflowEvent: "push",

  });

  expect(octokit.rest.actions.listWorkflowRuns).toHaveBeenCalledWith({
    owner: "billyvg",
    repo: "sentry",
    workflow_id: 1234,
    branch: "main",
    per_page: 10,
    status: "success",
    event: "push",
  });

  expect(octokit.rest.actions.listWorkflowRunArtifacts).toHaveBeenCalledWith({
    owner: "billyvg",
    repo: "sentry",
    run_id: 152081708,
  });

  expect(downloadResult).not.toBeUndefined();
});
