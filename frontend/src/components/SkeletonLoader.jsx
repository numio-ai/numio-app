/**
 * Skeleton loader for high-traffic pages (Overview, Feed, Recommendations).
 * Renders animated placeholder blocks that mimic the page's card layout.
 *
 * Variants:
 *   "dashboard"       — 2-row grid of metric cards + chart placeholder
 *   "feed"            — stacked list rows
 *   "recommendations" — stacked card rows
 */

const shimmerKeyframes = `
@keyframes numio-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;

const shimmerStyle = {
  background: "linear-gradient(90deg, var(--bg-muted, #f1f3f5) 25%, var(--bg-subtle, #f9fafb) 50%, var(--bg-muted, #f1f3f5) 75%)",
  backgroundSize: "800px 100%",
  animation: "numio-shimmer 1.5s infinite linear",
  borderRadius: "var(--radius-sm, 6px)",
};

function Block({ width = "100%", height = 16, style }) {
  return <div style={{ ...shimmerStyle, width, height, ...style }} />;
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "var(--card, #fff)",
        border: "1px solid var(--border, #e5e5e5)",
        borderRadius: "var(--radius-lg, 12px)",
        padding: "20px 24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Metric cards row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <Block width={80} height={10} />
            <Block width={120} height={22} style={{ marginTop: 12 }} />
            <Block width={60} height={10} style={{ marginTop: 8 }} />
          </Card>
        ))}
      </div>
      {/* Chart placeholder */}
      <Card>
        <Block width={160} height={12} />
        <Block width="100%" height={180} style={{ marginTop: 16 }} />
      </Card>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Card key={i} style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Block width={32} height={32} style={{ borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <Block width="60%" height={12} />
              <Block width="40%" height={10} />
            </div>
            <Block width={60} height={20} style={{ borderRadius: 10, flexShrink: 0 }} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function RecommendationsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <Block width="50%" height={14} />
              <Block width="80%" height={10} />
              <Block width="30%" height={10} />
            </div>
            <Block width={80} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
          </div>
        </Card>
      ))}
    </div>
  );
}

const variants = {
  dashboard: DashboardSkeleton,
  feed: FeedSkeleton,
  recommendations: RecommendationsSkeleton,
};

export default function SkeletonLoader({ variant = "dashboard" }) {
  const Skeleton = variants[variant] || DashboardSkeleton;
  return (
    <>
      <style>{shimmerKeyframes}</style>
      <Skeleton />
    </>
  );
}
