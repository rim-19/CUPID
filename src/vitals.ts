import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';

type Reporter = (metric: Metric) => void;

const defaultReporter: Reporter = (metric) => {
  // Replace with a beacon to your analytics endpoint in production.
  // eslint-disable-next-line no-console
  console.log(`[web-vitals] ${metric.name}: ${Math.round(metric.value)}`);
};

export function reportWebVitals(report: Reporter = defaultReporter): void {
  onCLS(report);
  onINP(report);
  onLCP(report);
  onFCP(report);
  onTTFB(report);
}
