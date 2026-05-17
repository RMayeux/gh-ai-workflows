import { createRunner } from '@core/workflow-runner';
import { runPRReviewWorkflow } from '../src/features/pr-review';

createRunner(runPRReviewWorkflow).run();
