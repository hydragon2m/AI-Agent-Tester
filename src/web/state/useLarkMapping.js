import { useState } from 'react';

export const DEFAULT_LARK_MAPPING = {
  priority: { high: '', medium: '', low: '' },
  type: { positive: '', negative: '', edge: '', ui: '', security: '', performance: '' },
};

export function useLarkMapping() {
  const [larkMapping, setLarkMapping] = useState(() => (
    JSON.parse(localStorage.getItem('qa_lark_mapping') || JSON.stringify(DEFAULT_LARK_MAPPING))
  ));

  function saveLarkMapping(next) {
    setLarkMapping(next);
    localStorage.setItem('qa_lark_mapping', JSON.stringify(next));
  }

  return { larkMapping, saveLarkMapping };
}
