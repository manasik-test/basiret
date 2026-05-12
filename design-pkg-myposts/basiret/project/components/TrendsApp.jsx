// Trends — App shell that hosts the three layouts on a design canvas

const TrendsApp = () => {
  return (
    <div dir="rtl" style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar active="trends" />
      <main style={{ flex: 1, minWidth: 0 }}>
        <TrendsLayoutA />
        <MPGAskFab />
      </main>
    </div>
  );
};

Object.assign(window, { TrendsApp });
