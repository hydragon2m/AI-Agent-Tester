import { useCallback, useEffect, useState } from 'react';
import {
  fetchSkillRuns,
  createSkillRun,
  renameSkillRun,
  deleteSkillRun,
  restoreSkillRun,
} from '../backend-api/skill-runs.api';

export function useSkillHistory(nodeId, skill) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!nodeId || !skill) {
      setRuns([]);
      return [];
    }
    setLoading(true);
    try {
      const list = await fetchSkillRuns(nodeId, skill);
      setRuns(list);
      return list;
    } finally {
      setLoading(false);
    }
  }, [nodeId, skill]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function saveRun(payload) {
    if (!nodeId || !skill) return null;
    const run = await createSkillRun({ nodeId, skill, ...payload });
    await refresh();
    return run;
  }

  async function rename(id, title) {
    await renameSkillRun(id, title);
    await refresh();
  }

  async function remove(id) {
    await deleteSkillRun(id);
    await refresh();
  }

  async function restore(id) {
    const run = await restoreSkillRun(id);
    await refresh();
    return run;
  }

  return { runs, loading, refresh, saveRun, rename, remove, restore };
}
