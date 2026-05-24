export {
  createTraceCarrier,
  extractTraceContext,
  getCurrentTraceSnapshot,
  injectTraceHeaders,
  initializeTracing,
  runWithSpan,
  shutdownTracing,
  startSpan,
} from './tracing.js';
export type {
  SpanHandle,
  TraceCarrier,
  TraceSnapshot,
  TracingBootstrapOptions,
  TracingSpanOptions,
} from './tracing.js';