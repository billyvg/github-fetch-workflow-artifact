/* eslint-env node */
import path from "path";

import { exec } from "@actions/exec";
import * as github from "@actions/github";
import * as io from "@actions/io";

type DownloadArtifactParams = {
  owner: string;
  repo: string;
  artifactId: number;
  artifactName: string;
  downloadPath: string;
};

/**
 * Use GitHub API to fetch artifact download url, then
 * download and extract artifact to `downloadPath`
 */
export async function downloadOtherWorkflowArtifact(
  octokit: ReturnType<typeof github.getOctokit>,
  {
    owner,
    repo,
    artifactId,
    artifactName,
    downloadPath,
  }: DownloadArtifactParams
) {
  const artifact = await octokit.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: "zip",
  });

  // Make sure output path exists
  try {
    await io.mkdirP(downloadPath);
  } catch {
    // ignore errors
  }

  const downloadFile = path.resolve(downloadPath, `${artifactName}.zip`);

  await exec("wget", [
    "-nv",
    "--retry-connrefused",
    "--waitretry=1",
    "--read-timeout=20",
    "--timeout=15",
    "-t",
    "0",
    "-O",
    downloadFile,
    artifact.url,
  ]);

  await exec("unzip", ["-q", "-d", downloadPath, downloadFile], {
    silent: true,
  });

  return true;
}
