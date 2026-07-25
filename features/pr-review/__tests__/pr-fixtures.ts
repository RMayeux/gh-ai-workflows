export interface PRFixture {
  details: unknown;
  diff: string;
  files: string[];
}

export const PR_FIXTURES: Record<string, PRFixture> = {
  'small-pr': {
    details: {
      title: 'Fix typo in README',
      body: 'Corrected a typo in the introduction.',
      additions: 1,
      deletions: 1,
    },
    diff: '--- a/README.md\n+++ b/README.md\n@@ -1,1 +1,1 @@\n- This is a typo.\n+ This is a fix.',
    files: ['README.md'],
  },
  'huge-pr': {
    details: {
      title: 'Massive refactor of core logic',
      body: 'This PR touches almost everything. Moving logic to new modules.',
      additions: 5000,
      deletions: 3000,
    },
    diff: '--- a/src/core.ts\n+++ b/src/core.ts\n' + '@@ -1,1 +1,1 @@\n- old\n+ new\n'.repeat(1000),
    files: ['src/core.ts', 'src/utils.ts', 'src/types.ts', 'src/index.ts'],
  },
  'monorepo-pr': {
    details: {
      title: 'Update shared types across packages',
      body: 'Updating the base interface in core and implementing it in github and providers.',
      additions: 100,
      deletions: 50,
    },
    diff: '--- a/packages/core/src/types.ts\n+++ b/packages/core/src/types.ts\n@@ -1,1 +1,1 @@\n- interface Base {}\n+ interface Base { id: string }\n\n--- a/packages/github/src/index.ts\n+++ b/packages/github/src/index.ts\n@@ -1,1 +1,1 @@\n- class GH implements Base {}\n+ class GH implements Base { id = "gh" }',
    files: ['packages/core/src/types.ts', 'packages/github/src/index.ts'],
  },
  'docs-only-pr': {
    details: {
      title: 'Update documentation',
      body: 'Added more examples to ARCHITECTURE.md',
      additions: 200,
      deletions: 10,
    },
    diff: '--- a/docs/ARCHITECTURE.md\n+++ b/docs/ARCHITECTURE.md\n@@ -10,1 +10,20 @@\n- Old doc\n+ New detailed doc\n+ with examples...',
    files: ['docs/ARCHITECTURE.md', 'docs/PROMPTS.md'],
  },
  'breaking-change-pr': {
    details: {
      title: 'Change API endpoint',
      body: 'Updating the API endpoint. This is a breaking change for consumers.',
      additions: 50,
      deletions: 50,
    },
    diff: '--- a/packages/core/src/index.ts\n+++ b/packages/core/src/index.ts\n@@ -1,1 +1,1 @@\n- export const API_URL = "v1"\n+ export const API_URL = "v2"',
    files: ['packages/core/src/index.ts'],
  },
  'malformed-pr': {
    details: {
      title: 'WIP',
      body: '',
      additions: 0,
      deletions: 0,
    },
    diff: '',
    files: [],
  },
};
