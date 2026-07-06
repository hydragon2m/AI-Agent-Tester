import { useState } from 'react';

export function useSkillWorkspace() {
  const [activeSkill, setActiveSkill] = useState('testcase');
  const [inputs, setInputs] = useState({});
  const [outputs, setOutputs] = useState({});
  const [rawOutputs, setRawOutputs] = useState({});
  const [options, setOptions] = useState({
    priority: 'High',
    types: ['Positive', 'Negative', 'Boundary', 'Edge Case'],
    apiFormat: 'postman',
    browser: 'chromium',
    language: 'typescript',
  });

  const input = inputs[activeSkill] || '';
  const output = outputs[activeSkill] || null;
  const rawOutput = rawOutputs[activeSkill] || '';

  function setSkillInput(value) {
    setInputs(prev => ({ ...prev, [activeSkill]: value }));
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
    options,
    setOptions,
    setSkillInput,
    setSkillOutput,
    clearSkillOutput,
  };
}
