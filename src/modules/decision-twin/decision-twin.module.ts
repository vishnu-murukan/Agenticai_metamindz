import { Module } from '@nitrostack/core';
import { DecisionTwinTools } from './decision-twin.tools.js';
import { DecisionTwinResources } from './decision-twin.resources.js';
import { DecisionTwinPrompts } from './decision-twin.prompts.js';

@Module({
  name: 'decision-twin',
  description: 'Multi-Agent Manufacturing Decision Twin Module',
  controllers: [DecisionTwinTools, DecisionTwinResources, DecisionTwinPrompts],
  providers: [DecisionTwinTools, DecisionTwinResources, DecisionTwinPrompts]
})
export class DecisionTwinModule {}
