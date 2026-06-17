/**
 * 测试 /chat/2 接口 - 带详细日志
 */
const http = require('http');

const testData = {
  message: '老师：这次期末考试感觉怎么样？\n学生：老师，我这次考得不太好。\n老师：能说说原因吗？\n学生：这学期一直在做项目，花了很多时间，导致复习时间不够。',
  basicInfo: {
    interviewer: '李老师',
    studentName: '张三',
    studentId: '2021001234',
    conversationTypeLabel: '期末谈话'
  }
};

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/chat/2',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('发送测试请求到 /chat/2...');
console.log('消息长度:', testData.message.length);

const req = http.request(options, (res) => {
  console.log('状态码:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('响应内容:');
    console.log(data);
  });
});

req.on('error', (err) => {
  console.error('请求错误:', err.message);
});

req.write(JSON.stringify(testData));
req.end();
