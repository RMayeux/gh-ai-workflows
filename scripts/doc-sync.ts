import { createRunner } from '@core/workflow-runner';
import { runDocSyncWorkflow } from '@features/doc-sync';

createRunner(runDocSyncWorkflow).run();
