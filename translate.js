const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const replacements = {
  'Tạo Project mới': 'Create Project',
  'Tên Project': 'Project Name',
  'Mô tả ngắn, ngữ cảnh': 'Context/Description',
  'Hủy': 'Cancel',
  'Lưu': 'Save',
  'Tạo mới': 'Create New',
  'Tên ': 'Name ',
  'Đổi tên': 'Rename',
  'Xóa': 'Delete',
  'Mức độ ưu tiên:': 'Priority:',
  'Tất cả (High/Med/Low)': 'All (High/Med/Low)',
  'Lấy Prompt Thủ Công': 'Copy Manual Prompt',
  'Cập nhật / Bổ sung': 'Update / Append',
  'Sinh Test Cases': 'Generate Test Cases',
  'Kết quả': 'Result',
  'Copy văn bản': 'Copy Text',
  'Copy cho Lark': 'Copy for Lark',
  'Tải JSON': 'Download JSON',
  'Nhập requirement của bạn vào đây': 'Enter your requirement here',
  'Dùng ví dụ': 'Use Example',
  'Cấu hình chung': 'Global Config',
  'Quản lý API Key': 'API Key Management',
  'Chế độ Demo': 'Demo Mode',
  'Trợ giúp': 'Help',
  'Nâng cao': 'Advanced',
  'Mẹo:': 'Tip:',
  'Gõ': 'Type',
  'hoặc mô tả chức năng...': 'or click here to manage Snippets'
};

for (const [vie, eng] of Object.entries(replacements)) {
  // Simple replace
  html = html.split(vie).join(eng);
}

// Fix mangled characters from previous powershell command
html = html.replace(/\?\? L\?y Prompt Th\? Cng/g, 'Copy Manual Prompt');
html = html.replace(/C\?p nh\?t \/ B\? sung/g, 'Update / Append');
html = html.replace(/\?\? M\?o: G/g, '💡 Tip: Type');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Translated index.html');
