import { useState } from 'react';

export function useSkillWorkspace() {
  const [activeSkill, setActiveSkill] = useState('testcase');
  const [inputs, setInputs] = useState({});
  const [outputs, setOutputs] = useState({});
  const [rawOutputs, setRawOutputs] = useState({});
  const [images, setImages] = useState({});
  const [options, setOptions] = useState({
    types: ['Positive', 'Negative', 'Boundary', 'Edge Case'],
    apiFormat: 'postman',
    browser: 'chromium',
    language: 'typescript',
    domain: '',
    detailLevel: 'full',
    coverage: 'balanced', // mức độ phủ khi gen TC: fast (~10) | balanced (~20, mặc định) | full (không giới hạn, tốn token)
    autoAudit: false, // mặc định KHÔNG tự đánh giá chất lượng TC (tiết kiệm token) — user tự bấm/tick
  });

  const input = inputs[activeSkill] || '';
  const output = outputs[activeSkill] || null;
  const rawOutput = rawOutputs[activeSkill] || '';
  const image = images[activeSkill] || null;

  function setSkillInput(value, skillKey = activeSkill) {
    setInputs(prev => ({ ...prev, [skillKey]: value }));
  }

  function setSkillImage(value, skillKey = activeSkill) {
    setImages(prev => ({ ...prev, [skillKey]: value }));
  }

  function setSkillOutput(value, raw = value, skillKey = activeSkill) {
    setOutputs(prev => ({ ...prev, [skillKey]: value }));
    setRawOutputs(prev => ({
      ...prev,
      [skillKey]: typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2),
    }));
  }

  function clearSkillOutput(skillKey) {
    setOutputs(prev => ({ ...prev, [skillKey]: null }));
    setRawOutputs(prev => ({ ...prev, [skillKey]: '' }));
  }

  return {
    activeSkill,
    setActiveSkill,
    input,
    output,
    rawOutput,
    outputs,
    image,
    images,
    options,
    setOptions,
    setSkillInput,
    setSkillOutput,
    setSkillImage,
    clearSkillOutput,
  };
}
