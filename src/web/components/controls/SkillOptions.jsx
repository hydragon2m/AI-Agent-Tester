export function SkillOptions({ activeSkill, options, setOptions }) {
  function patch(value) {
    setOptions(prev => ({ ...prev, ...value }));
  }

  if (activeSkill === 'testcase') {
    return (
      <div className="skill-options-row">
        <div className="toggle-group">
          {['Positive', 'Negative', 'Boundary', 'Edge Case', 'Security', 'UI/UX'].map(type => (
            <button
              key={type}
              className={`toggle-btn ${options.types.includes(type) ? 'active' : ''}`}
              onClick={() => patch({ types: options.types.includes(type) ? options.types.filter(t => t !== type) : [...options.types, type] })}
            >
              {type}
            </button>
          ))}
        </div>
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: 'auto', cursor: 'pointer', whiteSpace: 'nowrap' }}
          title="Nếu bật: sau khi sinh TC sẽ tự gọi AI đánh giá chất lượng (tốn thêm ~1 lượt token). Nếu tắt: bấm nút 'Đánh giá chất lượng' ở Output khi cần."
        >
          <input type="checkbox" checked={!!options.autoAudit} onChange={e => patch({ autoAudit: e.target.checked })} />
          Tự động đánh giá chất lượng (tốn thêm token)
        </label>
      </div>
    );
  }

  if (activeSkill === 'srs') {
    return (
      <div className="skill-options-row">
        <label style={{ flex: 1 }}>
          Domain / Ngữ cảnh nghiệp vụ
          <input
            type="text"
            className="pf-input"
            style={{ flex: 1, width: '100%' }}
            value={options.domain}
            onChange={e => patch({ domain: e.target.value })}
            placeholder="ví dụ: fast-track, transfer, esim... (tùy chọn)"
          />
        </label>
      </div>
    );
  }

  if (activeSkill === 'apitest') {
    return (
      <div className="skill-options-row">
        <label>
          Format
          <select value={options.apiFormat} onChange={e => patch({ apiFormat: e.target.value })}>
            <option value="postman">Postman Collection</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
        </label>
      </div>
    );
  }

  if (activeSkill === 'uitest') {
    return (
      <div className="skill-options-row">
        <label>
          Browser
          <select value={options.browser} onChange={e => patch({ browser: e.target.value })}>
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit</option>
          </select>
        </label>
        <label>
          Language
          <select value={options.language} onChange={e => patch({ language: e.target.value })}>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="skill-options-row h-[32px] flex items-center">
      <span className="text-[10.5px] text-zinc-500 font-normal italic">
        Bug Analyzer không yêu cầu cấu hình thêm.
      </span>
    </div>
  );
}
