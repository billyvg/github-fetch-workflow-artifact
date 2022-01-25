import retry from "async-retry";

import * as github from "@actions/github";

import {
  getArtifactsForBranchAndWorkflow,
  GetArtifactsForBranchAndWorkflow,
} from "./getArtifactsForBranchAndWorkflow";

import {
  DownloadArtifactParams,
  downloadOtherWorkflowArtifact,
} from "./downloadOtherWorkflowArtifact";

type Params = GetArtifactsForBranchAndWorkflow &
  Omit<DownloadArtifactParams, "artifactId">;

export class NoArtifactsError extends Error {}

export default async function download(
  octokit: ReturnType<typeof github.getOctokit>,
  { owner, repo, artifactName, downloadPath, ...params }: Params
) {
  const artifacts = await getArtifactsForBranchAndWorkflow(octokit, {
    owner,
    repo,
    artifactName,
    ...params,
  });

  if (!artifacts) {
    throw new NoArtifactsError("No artifacts found");
  }

  await retry(
    async () =>
      await downloadOtherWorkflowArtifact(octokit, {
        owner,
        repo,
        artifactName,
        artifactId: artifacts.artifact.id,
        downloadPath,
      }),
    {
      onRetry: (err) => {
        console.error(err); // eslint-disable-line no-console
      },
    }
  );

  return artifacts;
}
