const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const revertMap = {
  'Create Project': 'Tạo Project mới',
  'Project Name': 'Tên Project',
  'Context/Description': 'Mô tả ngắn, ngữ cảnh',
  '>Cancel<': '>Hủy<',
  '💾 Save Project': '💾 Lưu Project',
  '💾 Save<': '💾 Lưu<',
  'Create New': 'Tạo mới',
  'Name ': 'Tên ',
  'Rename': 'Đổi tên',
  '>Delete<': '>Xóa<',
  'Priority:': 'Mức độ ưu tiên:',
  'All (High/Med/Low)': 'Tất cả (High/Med/Low)',
  'Copy Manual Prompt': 'Lấy Prompt Thủ Công',
  'Update / Append': 'Cập nhật / Bổ sung',
  'Generate Test Cases': 'Sinh Test Cases',
  '✅ Result': '✅ Kết quả',
  'Copy Text': 'Copy văn bản',
  'Copy for Lark': 'Copy cho Lark',
  'Download JSON': 'Tải JSON',
  'Enter your requirement here': 'Nhập requirement của bạn vào đây',
  'Use Example': 'Dùng ví dụ',
  'Global Config': 'Cấu hình chung',
  'API Key Management': 'Quản lý API Key',
  'Demo Mode': 'Chế độ Demo',
  '>Help<': '>Trợ giúp<',
  '>Advanced<': '>Nâng cao<'
};

for (const [eng, vie] of Object.entries(revertMap)) {
  html = html.split(eng).join(vie);
}

// Remove snippets UI
html = html.replace(/<span class="tip" style="cursor:pointer;" id="btn-manage-snippets">.*?<\/span>/g, '<span class="tip">💡 Mẹo: Gõ <code>/login</code> hoặc mô tả chức năng...</span>');
html = html.replace(/<!-- Manage Snippets Modal -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, '');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Reverted index.html');
