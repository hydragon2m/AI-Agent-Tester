import { useEffect, useState } from 'react';
import { fetchLarkConfigApi, saveLarkConfigApi, testLarkConnectionApi } from '../backend-api/lark.api';

const DEFAULT_LARK_CONFIG = {
  app_id: '',
  app_secret: '',
  approved_status_label: 'Approved',
  hasSecret: false,
};

export function useLarkConfig(onToast) {
  const [larkConfig, setLarkConfig] = useState(DEFAULT_LARK_CONFIG);
  const [testingConnection, setTestingConnection] = useState(false);

  async function fetchLarkConfig() {
    const row = await fetchLarkConfigApi();
    setLarkConfig(prev => ({ ...prev, ...row, app_secret: '' }));
  }

  useEffect(() => {
    fetchLarkConfig().catch(e => onToast?.(`Lỗi tải cấu hình Lark: ${e.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveLarkConfig() {
    const saved = await saveLarkConfigApi({
      app_id: larkConfig.app_id,
      app_secret: larkConfig.app_secret,
      approved_status_label: larkConfig.approved_status_label,
    });
    setLarkConfig(prev => ({ ...prev, ...saved, app_secret: '' }));
  }

  async function testConnection() {
    setTestingConnection(true);
    try {
      await saveLarkConfig();
      await testLarkConnectionApi();
      onToast?.('Kết nối Lark thành công');
    } catch (e) {
      onToast?.(`Kết nối Lark thất bại: ${e.message}`);
    } finally {
      setTestingConnection(false);
    }
  }

  return {
    larkConfig,
    setLarkConfig,
    saveLarkConfig,
    testConnection,
    testingConnection,
  };
}
