import { createRunner } from '@core/workflow-runner';
import { runQATestCasesWorkflow } from '../src/features/qa-test-cases';

createRunner(runQATestCasesWorkflow).run();
