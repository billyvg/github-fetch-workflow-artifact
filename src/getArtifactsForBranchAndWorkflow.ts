import { GetResponseDataTypeFromEndpointMethod } from "@octokit/types";
import * as core from "@actions/core";
import * as github from "@actions/github";

type Octokit = ReturnType<typeof github.getOctokit>;
type WorkflowRun = GetResponseDataTypeFromEndpointMethod<
  Octokit["rest"]["actions"]["listWorkflowRuns"]
>["workflow_runs"][number];
type Artifacts = GetResponseDataTypeFromEndpointMethod<
  Octokit["rest"]["actions"]["listWorkflowRunArtifacts"]
>["artifacts"][number];

export type GetArtifactsForBranchAndWorkflowReturn = {
  artifact: Artifacts;
  workflowRun: WorkflowRun;
} | null;

export type GetArtifactsForBranchAndWorkflow = {
  owner: string;
  repo: string;
  branch: string;

  /**
   * The name of the workflow (e.g. the `name` key in the workflow, otherwise the root workflow name)
   */
  workflowName: string;

  /**
   * The name of the artifact
   */
  artifactName: string;

  /**
   * A specific commit sha to look for the artifact
   */
  commit?: string;

  /**
   * The number of results to query for
   */
  perPage?: number;

  /**
   * The max number of pages to query for
   */
  maxPages?: number;

  /**
   * Filter workflow runs by how the workflow was triggered. See the `event`
   * parameter here:
   * https://octokit.github.io/rest.js/v18#actions-list-workflow-runs
   */
  workflowEvent?: string;
};

// max pages of workflows to pagination through
const DEFAULT_MAX_PAGES = 50;
// max results per page
const DEFAULT_PAGE_LIMIT = 10;

/**
 * Fetch artifacts from a workflow run from a branch
 *
 * This is a bit hacky since GitHub Actions currently does not directly
 * support downloading artifacts from other workflows
 */
export async function getArtifactsForBranchAndWorkflow(
  octokit: Octokit,
  {
    owner,
    repo,
    workflowName,
    branch,
    commit,
    artifactName,
    maxPages,
    perPage,
    workflowEvent,
  }: GetArtifactsForBranchAndWorkflow
): Promise<GetArtifactsForBranchAndWorkflowReturn> {
  core.startGroup(
    `getArtifactsForBranchAndWorkflow - workflow:"${workflowName}",  branch:"${branch}"${
      commit ? `,  commit:"${commit}"` : ""
    }`
  );

  let repositoryWorkflow = null;

  // For debugging
  let allWorkflows: string[] = [];

  //
  // Find workflow id from `workflowName`
  //
  for await (const response of octokit.paginate.iterator(
    octokit.rest.actions.listRepoWorkflows,
    {
      owner,
      repo,
    }
  )) {
    const targetWorkflow = response.data.find(
      ({ name }) => name === workflowName
    );

    allWorkflows = allWorkflows.concat(response.data.map(({ name }) => name));

    // If not found in responses, continue to search on next page
    if (!targetWorkflow) {
      continue;
    }

    repositoryWorkflow = targetWorkflow;
    break;
  }

  if (!repositoryWorkflow) {
    core.debug(
      `Unable to find workflow with name "${workflowName}" in the repository. Found workflows: ${allWorkflows.join(
        ", "
      )}`
    );
    core.endGroup();
    return null;
  }

  const workflow_id = repositoryWorkflow.id;

  let currentPage = 0;
  let completedWorkflowRuns: WorkflowRun[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.actions.listWorkflowRuns,
    {
      owner,
      repo,
      workflow_id,
      branch,
      status: "success",
      per_page: perPage || DEFAULT_PAGE_LIMIT,
      ...(workflowEvent ? { event: workflowEvent } : {}),
    }
  )) {
    if (!response.data.length) {
      core.warning(`Workflow ${workflow_id} not found in branch ${branch}`);
      core.endGroup();
      return null;
    }

    // Do not allow downloading artifacts from a fork.
    const workflowRuns = response.data.filter(
      (workflowRun) =>
        workflowRun.head_repository.full_name === `${owner}/${repo}`
    );

    if (!workflowRuns.length) {
      continue;
    }

    const workflowRunsForCommit = commit
      ? workflowRuns.filter(
          (run: typeof workflowRuns[number]) => run.head_sha === commit
        )
      : workflowRuns;

    if (workflowRunsForCommit.length) {
      completedWorkflowRuns = completedWorkflowRuns.concat(
        workflowRunsForCommit
      );
      break;
    }

    if (currentPage > (maxPages ?? DEFAULT_MAX_PAGES)) {
      core.warning(
        `Workflow ${workflow_id} not found in branch: ${branch}${
          commit ? ` and commit: ${commit}` : ""
        }`
      );
      core.endGroup();
      return null;
    }

    currentPage++;
  }

  // Search through workflow artifacts until we find a workflow run w/ artifact name that we are looking for
  for (const workflowRun of completedWorkflowRuns) {
    core.debug(`Checking artifacts for workflow run: ${workflowRun.html_url}`);

    const {
      data: { artifacts },
    } = await octokit.rest.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: workflowRun.id,
    });

    if (!artifacts) {
      core.debug(
        `Unable to fetch artifacts for branch: ${branch}, workflow: ${workflow_id}, workflowRunId: ${workflowRun.id}`
      );
    } else {
      const foundArtifact = artifacts.find(({ name }) => name === artifactName);
      if (foundArtifact) {
        core.debug(`Found suitable artifact: ${foundArtifact.url}`);
        return {
          artifact: foundArtifact,
          workflowRun,
        };
      }
    }
  }

  core.warning(`Artifact not found: ${artifactName}`);
  core.endGroup();
  return null;
}
