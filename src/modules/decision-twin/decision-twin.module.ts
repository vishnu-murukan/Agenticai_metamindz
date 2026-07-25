import { Module } from '@nitrostack/core';
import { DecisionTwinTools } from './decision-twin.tools.js';
import { DecisionTwinResources } from './decision-twin.resources.js';
import { DecisionTwinPrompts } from './decision-twin.prompts.js';

@Module({
  name: 'decision-twin',
  description: 'Decision Twin MCP module for manufacturing operations, telemetry, risk calculation, and work orders',
  controllers: [DecisionTwinTools, DecisionTwinResources, DecisionTwinPrompts]
})
export class DecisionTwinModule {}
