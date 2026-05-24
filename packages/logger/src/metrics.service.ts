import { Injectable } from '@nestjs/common';
import type { ObservabilityMetricLabels, PrometheusMetricSnapshot } from './types.js';

type MetricKind = 'counter' | 'gauge' | 'histogram';

type MetricEntry = Readonly<{
  readonly name: string;
  readonly labels: ObservabilityMetricLabels;
  readonly value: number;
  readonly kind: MetricKind;
}>;

const sortLabels = (labels: ObservabilityMetricLabels): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([, value]) => value !== undefined && value !== null)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)]),
  );
};

const labelsKey = (labels: ObservabilityMetricLabels): string => JSON.stringify(sortLabels(labels));

const escapeLabelValue = (value: string): string => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, MetricEntry>();
  private readonly gauges = new Map<string, MetricEntry>();
  private readonly histograms = new Map<string, MetricEntry>();

  increment(name: string, labels: ObservabilityMetricLabels = {}, value = 1): void {
    this.updateMetric(this.counters, 'counter', name, labels, value);
  }

  setGauge(name: string, value: number, labels: ObservabilityMetricLabels = {}): void {
    this.updateMetric(this.gauges, 'gauge', name, labels, value);
  }

  observe(name: string, value: number, labels: ObservabilityMetricLabels = {}): void {
    this.updateMetric(this.histograms, 'histogram', name, labels, value);
  }

  snapshot(): PrometheusMetricSnapshot[] {
    return [...this.counters.values(), ...this.gauges.values(), ...this.histograms.values()];
  }

  toPrometheusText(): string {
    const lines: string[] = [];

    for (const entry of this.snapshot()) {
      const labels = Object.entries(sortLabels(entry.labels))
        .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
        .join(',');
      const suffix = labels.length > 0 ? `{${labels}}` : '';
      lines.push(`${entry.name}${suffix} ${entry.value}`);
    }

    return lines.join('\n');
  }

  private updateMetric(
    store: Map<string, MetricEntry>,
    kind: MetricKind,
    name: string,
    labels: ObservabilityMetricLabels,
    value: number,
  ): void {
    const key = `${name}:${labelsKey(labels)}`;
    const current = store.get(key);

    if (current === undefined) {
      store.set(key, { name, labels, value, kind });
      return;
    }

    const nextValue = kind === 'gauge' ? value : current.value + value;
    store.set(key, { ...current, value: nextValue });
  }
}