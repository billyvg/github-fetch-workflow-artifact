import retry from "async-retry";

import * as github from "@actions/github";

import {
  getArtifactsForBranchAndWorkflow,
  GetArtifactsForBranchAndWorkflow,
} from "./getArtifactsForBranchAndWorkflow";

import { downloadOtherWorkflowArtifact } from "./downloadOtherWorkflowArtifact";

type Params = {
  downloadPath: string;
} & GetArtifactsForBranchAndWorkflow;

export class NoArtifactsError extends Error {}

export default async function download(
  octokit: ReturnType<typeof github.getOctokit>,
  { owner, repo, artifactName, workflow_id, branch, downloadPath }: Params
) {
  const artifacts = await getArtifactsForBranchAndWorkflow(octokit, {
    owner,
    repo,
    workflow_id,
    branch,
    artifactName,
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
