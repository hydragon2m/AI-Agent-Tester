export function SkillOptions({ activeSkill, options, setOptions }) {
  function patch(value) {
    setOptions(prev => ({ ...prev, ...value }));
  }

  if (activeSkill === 'testcase') {
    return (
      <div className="skill-options-row">
        <label>
          Priority
          <select value={options.priority} onChange={e => patch({ priority: e.target.value })}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>
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
      </div>
    );
  }

  if (activeSkill === 'srs') {
    return (
      <div className="skill-options-row">
        <label>
          Domain / Ngữ cảnh nghiệp vụ
          <input
            type="text"
            className="pf-input"
            value={options.domain}
            onChange={e => patch({ domain: e.target.value })}
            placeholder="ví dụ: fast-track, transfer, esim... (tùy chọn)"
          />
        </label>
        <div className="toggle-group">
          {[{ value: 'full', label: 'Đầy đủ' }, { value: 'concise', label: 'Ngắn gọn' }].map(opt => (
            <button
              key={opt.value}
              className={`toggle-btn ${options.detailLevel === opt.value ? 'active' : ''}`}
              onClick={() => patch({ detailLevel: opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>
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

  return null;
}
