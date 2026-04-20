const http = require('http');

http.get('http://localhost:7000/api/Marketplace/categories', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers['content-type']);
    console.log('BODY:', data);
  });
}).on('error', (err) => {
  console.error('ERROR:', err.message);
});
