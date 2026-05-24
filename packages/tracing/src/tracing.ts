import { context as otelContext, propagation, trace, SpanKind, SpanStatusCode, type Attributes, type Context, type Span } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor, ConsoleSpanExporter, type SpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';

export type TraceCarrier = Record<string, string>;

export type TraceSnapshot = Readonly<{
  readonly traceId?: string;
  readonly spanId?: string;
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly carrier: TraceCarrier;
}>;

export type TracingBootstrapOptions = Readonly<{
  readonly serviceName: string;
  readonly serviceVersion?: string;
  readonly otlpEndpoint?: string;
}>;

export type TracingSpanOptions = Readonly<{
  readonly kind?: SpanKind;
  readonly attributes?: Attributes;
  readonly parentContext?: Context;
}>;

export type SpanHandle = Readonly<{
  readonly span: Span;
  readonly context: Context;
  readonly snapshot: TraceSnapshot;
}>;

const TRACE_SCOPE_NAME = 'devflow';

const carrierGetter = {
  get(carrier: TraceCarrier, key: string): string | undefined {
    return carrier[key];
  },
  keys(carrier: TraceCarrier): string[] {
    return Object.keys(carrier);
  },
};

const carrierSetter = {
  set(carrier: TraceCarrier, key: string, value: string): void {
    carrier[key] = value;
  },
};

let provider: NodeTracerProvider | undefined;

const resolveExporter = (otlpEndpoint?: string): SpanExporter => {
  const endpoint = otlpEndpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

  if (endpoint) {
    return new OTLPTraceExporter({ url: endpoint });
  }

  return new ConsoleSpanExporter();
};

const readSpanContext = (contextValue: Context = otelContext.active()) => trace.getSpanContext(contextValue);

const buildSnapshot = (contextValue: Context = otelContext.active()): TraceSnapshot => {
  const carrier: TraceCarrier = {};
  propagation.inject(contextValue, carrier, carrierSetter);
  const spanContext = readSpanContext(contextValue);

  return {
    ...(spanContext?.traceId === undefined ? {} : { traceId: spanContext.traceId }),
    ...(spanContext?.spanId === undefined ? {} : { spanId: spanContext.spanId }),
    ...(carrier.traceparent === undefined ? {} : { traceparent: carrier.traceparent }),
    ...(carrier.tracestate === undefined ? {} : { tracestate: carrier.tracestate }),
    carrier,
  };
};

const recordSpanError = (span: Span, error: unknown): void => {
  if (error instanceof Error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    return;
  }

  const message = typeof error === 'string' ? error : 'Unknown tracing error';
  span.setStatus({ code: SpanStatusCode.ERROR, message });
};

export const createTraceCarrier = (contextValue: Context = otelContext.active()): TraceCarrier => {
  const carrier: TraceCarrier = {};
  propagation.inject(contextValue, carrier, carrierSetter);
  return carrier;
};

export const extractTraceContext = (carrier: Readonly<TraceCarrier | null | undefined>): Context => {
  return propagation.extract(otelContext.active(), (carrier ?? {}) as TraceCarrier, carrierGetter);
};

export const getCurrentTraceSnapshot = (contextValue: Context = otelContext.active()): TraceSnapshot => {
  return buildSnapshot(contextValue);
};

export async function initializeTracing(options: TracingBootstrapOptions): Promise<void> {
  if (provider !== undefined) {
    return;
  }

  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      'service.name': options.serviceName,
      ...(options.serviceVersion === undefined ? {} : { 'service.version': options.serviceVersion }),
    }),
    spanProcessors: [new BatchSpanProcessor(resolveExporter(options.otlpEndpoint))],
  });
  provider.register({
    contextManager: new AsyncLocalStorageContextManager(),
    propagator: new W3CTraceContextPropagator(),
  });
}

export async function shutdownTracing(): Promise<void> {
  if (provider === undefined) {
    return;
  }

  const currentProvider = provider;
  provider = undefined;
  await currentProvider.shutdown();
}

export const startSpan = (name: string, options: TracingSpanOptions = {}): SpanHandle => {
  const parentContext = options.parentContext ?? otelContext.active();
  const spanOptions = {
    ...(options.kind === undefined ? {} : { kind: options.kind }),
    ...(options.attributes === undefined ? {} : { attributes: options.attributes }),
  };
  const span = trace.getTracer(TRACE_SCOPE_NAME).startSpan(name, spanOptions, parentContext);
  const context = trace.setSpan(parentContext, span);

  return {
    span,
    context,
    snapshot: buildSnapshot(context),
  };
};

export async function runWithSpan<T>(name: string, options: TracingSpanOptions, handler: (span: Span) => Promise<T>): Promise<T> {
  const handle = startSpan(name, options);

  try {
    return await otelContext.with(handle.context, () => handler(handle.span));
  } catch (error: unknown) {
    recordSpanError(handle.span, error);
    throw error;
  } finally {
    handle.span.end();
  }
}

export const injectTraceHeaders = (
  headers: Readonly<Record<string, string>> = {},
  contextValue: Context = otelContext.active(),
): Record<string, string> => {
  const carrier: TraceCarrier = { ...headers };
  propagation.inject(contextValue, carrier, carrierSetter);
  return carrier;
};
