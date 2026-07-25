import { McpApp, Module, ConfigModule } from '@nitrostack/core';
import { DecisionTwinModule } from './modules/decision-twin/decision-twin.module.js';
import { SystemHealthCheck } from './health/system.health.js';

/**
 * Root Application Module for Decision Twin MCP Server
 */
@McpApp({
  module: AppModule,
  server: {
    name: 'decision-twin-server',
    version: '1.0.0'
  },
  logging: {
    level: 'info'
  }
})
@Module({
  name: 'app',
  description: 'Root application module for Decision Twin',
  imports: [
    ConfigModule.forRoot(),
    DecisionTwinModule
  ],
  providers: [
    SystemHealthCheck,
  ]
})
export class AppModule {}
