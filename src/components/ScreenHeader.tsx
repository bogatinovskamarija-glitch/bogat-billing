export default function ScreenHeader({
  sheetCode,
  contextLabel,
  title,
  actions,
}: {
  sheetCode: string;
  contextLabel: string;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        marginBottom: 32,
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span className="label" style={{ color: "var(--text-dim)" }}>
            {sheetCode}
          </span>
          <span style={{ width: 24, height: 1, background: "var(--line)" }} />
          <span className="label">{contextLabel}</span>
        </div>
        <h1 className="screen-title">{title}</h1>
      </div>
      {actions && <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{actions}</div>}
    </div>
  );
}
