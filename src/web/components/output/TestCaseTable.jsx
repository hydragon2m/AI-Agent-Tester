export function TestCaseTable({ testCases }) {
  if (!testCases.length) return <div className="empty-state table-empty">Chưa có test case cho node hiện tại.</div>;
  return (
    <div className="tc-table-wrapper">
      <table className="tc-table">
        <thead>
          <tr>
            <th>TC ID</th>
            <th>Module</th>
            <th>Name</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Suite</th>
            <th>Steps</th>
            <th>Expected</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((tc, idx) => (
            <tr key={`${tc.id || 'tc'}-${idx}`}>
              <td>{tc.id || tc.externalId || `TC-${idx + 1}`}</td>
              <td>{tc.module || '-'}</td>
              <td>{tc.name}</td>
              <td><span className={`tc-badge type-${String(tc.type || '').toLowerCase().replace(/\W+/g, '-')}`}>{tc.type}</span></td>
              <td><span className={`tc-badge prio-${String(tc.priority || '').toLowerCase()}`}>{tc.priority}</span></td>
              <td>{tc.suite || '-'}</td>
              <td>{(Array.isArray(tc.steps) ? tc.steps : String(tc.steps || '').split(/\r?\n/).filter(Boolean)).map((step, i) => <div key={i}>{i + 1}. {String(step).replace(/^\s*\d+[.)]\s*/, '')}</div>)}</td>
              <td>{tc.expectedResult}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
