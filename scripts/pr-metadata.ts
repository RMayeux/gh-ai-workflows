import { createRunner } from '@core/workflow-runner';
import { runPRMetadataWorkflow } from '../src/features/pr-metadata';

createRunner(runPRMetadataWorkflow).run();
