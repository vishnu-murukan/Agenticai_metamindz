import { Module } from '@nitrostack/core';
import { DecisionTwinTools } from './decision-twin.tools.js';

@Module({
  name: 'decision-twin',
  description: 'Multi-Agent Manufacturing Decision Twin Module',
  providers: [
    DecisionTwinTools,
  ]
})
export class DecisionTwinModule {}
